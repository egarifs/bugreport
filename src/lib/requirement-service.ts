import { prisma } from "@/lib/db";
import { readDocText } from "@/lib/business-docs";
import { coverageOf, dorChecks, nextStatus, parseRequirementSections, type CaseState, type Coverage } from "@/lib/requirement";
import type { RequirementStatus } from "@prisma/client";

const OPEN_BUG = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED"] as const;

/** Samakan RequirementSection dengan versi dokumen yang berlaku. Bagian yang isinya berubah kembali ke APPROVED. */
export async function syncSections(projectId: string, projectKey: string, docId: string) {
  const doc = await prisma.businessDoc.findFirst({
    where: { id: docId, projectId },
    include: { versions: { where: { isCurrent: true, status: "APPROVED" }, take: 1 } },
  });
  const ver = doc?.versions[0];
  if (!doc || !ver) return null;
  const md = await readDocText(projectKey, ver);
  if (md === null) return { doc, version: ver, sections: [] };
  const parsed = parseRequirementSections(md);
  const existing = await prisma.requirementSection.findMany({ where: { docId } });
  const byAnchor = new Map(existing.map((s) => [s.anchor, s]));
  const ops = parsed.map((p) => {
    const cur = byAnchor.get(p.anchor);
    if (!cur) return prisma.requirementSection.create({ data: { docId, anchor: p.anchor, title: p.title, contentHash: p.hash, acceptanceCriteria: p.criteria } });
    if (cur.contentHash === p.hash) return null;
    return prisma.requirementSection.update({ where: { id: cur.id }, data: { title: p.title, contentHash: p.hash, status: "APPROVED", readyAt: null, devDoneAt: null, devDoneById: null, acceptanceCriteria: p.criteria } });
  }).filter((o): o is NonNullable<typeof o> => o !== null);
  const gone = existing.filter((s) => !parsed.some((p) => p.anchor === s.anchor)).map((s) => s.id);
  await prisma.$transaction([...ops, prisma.requirementSection.deleteMany({ where: { id: { in: gone } } })]);
  return { doc, version: ver, sections: parsed };
}

export interface RtmRow {
  id: string; anchor: string; title: string; status: RequirementStatus; coverage: Coverage;
  cases: { id: string; code: string; title: string; result: CaseState["result"]; needsRerun: boolean }[];
  openBugs: { key: string; number: number }[];
  passed: number;
}

/** RTM dihitung saat dibuka dari section ↔ test case ↔ hasil terakhir ↔ bug terbuka. Tidak disimpan. */
export async function loadRtm(projectId: string, projectKey: string, docId: string) {
  const synced = await syncSections(projectId, projectKey, docId);
  if (!synced) return null;
  const sections = await prisma.requirementSection.findMany({
    where: { docId },
    orderBy: { createdAt: "asc" },
    include: {
      testCases: {
        where: { status: { not: "DEPRECATED" } },
        select: { id: true, code: true, title: true, runItems: { select: { status: true, needsRerun: true, executedAt: true, bugLinks: { select: { bug: { select: { key: true, number: true, status: true } } } } } } },
      },
    },
  });
  const rows: RtmRow[] = [];
  for (const s of sections) {
    const bugs = new Map<string, { key: string; number: number }>();
    const cases = s.testCases.map((tc) => {
      const run = tc.runItems.filter((i) => i.status !== "NOT_RUN").sort((a, b) => +(b.executedAt ?? 0) - +(a.executedAt ?? 0))[0];
      for (const i of tc.runItems) for (const l of i.bugLinks) if ((OPEN_BUG as readonly string[]).includes(l.bug.status)) bugs.set(l.bug.key, { key: l.bug.key, number: l.bug.number });
      return { id: tc.id, code: tc.code, title: tc.title, result: (run?.status ?? "NOT_RUN") as CaseState["result"], needsRerun: tc.runItems.some((i) => i.needsRerun) };
    });
    const coverage = coverageOf(cases, bugs.size);
    const status = nextStatus(s.status, false, coverage, Boolean(s.sprintId));
    if (status !== s.status) await prisma.requirementSection.update({ where: { id: s.id }, data: { status } });
    rows.push({ id: s.id, anchor: s.anchor, title: s.title, status, coverage, cases, openBugs: [...bugs.values()], passed: cases.filter((c) => c.result === "PASS").length });
  }
  return { doc: synced.doc, version: synced.version, rows };
}

export async function sectionDor(sectionId: string) {
  const s = await prisma.requirementSection.findUnique({
    where: { id: sectionId },
    include: { doc: { include: { versions: { where: { isCurrent: true }, take: 1 } } }, _count: { select: { testCases: true } } },
  });
  if (!s) return null;
  const dor = dorChecks({ versionApproved: s.doc.versions[0]?.status === "APPROVED", criteria: s.acceptanceCriteria, moduleMarked: Boolean(s.moduleId), testCaseCount: s._count.testCases });
  return { section: s, dor };
}

/** Ringkasan cakupan requirement untuk laporan rilis: dokumen bisnis pertama (sama dengan RTM bawaan). */
export async function releaseCoverage(projectId: string, projectKey: string) {
  const doc = await prisma.businessDoc.findFirst({ where: { projectId }, orderBy: { title: "asc" }, select: { id: true, slug: true } });
  if (!doc) return null;
  const rtm = await loadRtm(projectId, projectKey, doc.id);
  if (!rtm || rtm.rows.length === 0) return null;
  return { slug: doc.slug, total: rtm.rows.length, verified: rtm.rows.filter((r) => r.coverage === "VERIFIED").length, withoutCase: rtm.rows.filter((r) => r.coverage === "NO_TC").length };
}
