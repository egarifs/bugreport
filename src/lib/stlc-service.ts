import { prisma } from "@/lib/db";
import type { Sprint } from "@prisma/client";
import { buildReleaseNotes, type DodFacts, type ExitFacts, type NoteBug } from "@/lib/stlc";

const OPEN = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED"] as const;
const DAY = 86_400_000;
const inSprintWindow = (s: Pick<Sprint, "startsAt" | "endsAt">) => ({ gte: s.startsAt, lt: new Date(+s.endsAt + DAY) });

export async function sprintDodFacts(projectId: string, sprint: Sprint): Promise<DodFacts> {
  const [open, runs, sections, summary] = await Promise.all([
    prisma.bug.findMany({ where: { projectId, sprintId: sprint.id, status: { in: [...OPEN] }, severity: { in: ["BLOCKER", "HIGH"] } }, select: { key: true, severity: true } }),
    prisma.testRun.findMany({ where: { projectId, createdAt: inSprintWindow(sprint), status: "IN_PROGRESS" }, select: { name: true } }),
    prisma.requirementSection.findMany({ where: { sprintId: sprint.id, status: { not: "VERIFIED" } }, select: { title: true } }),
    prisma.stlcDoc.count({ where: { projectId, kind: "TEST_SUMMARY", sprintId: sprint.id } }),
  ]);
  return {
    blockerOpen: open.filter((b) => b.severity === "BLOCKER").map((b) => b.key),
    highOpen: open.filter((b) => b.severity === "HIGH").map((b) => b.key),
    runsOpen: runs.map((r) => r.name),
    reqNotVerified: sections.map((s) => s.title),
    hasSummary: summary > 0,
  };
}

export async function exitFacts(projectId: string, target = 90): Promise<ExitFacts> {
  const [open, sections] = await Promise.all([
    prisma.bug.findMany({ where: { projectId, status: { in: [...OPEN] }, severity: { in: ["BLOCKER", "HIGH"] } }, select: { key: true, severity: true } }),
    prisma.requirementSection.findMany({ where: { doc: { projectId } }, select: { _count: { select: { testCases: true } } } }),
  ]);
  return {
    blockersOpen: open.filter((b) => b.severity === "BLOCKER").map((b) => b.key),
    highOpen: open.filter((b) => b.severity === "HIGH").map((b) => b.key),
    coveragePct: sections.length ? Math.round((sections.filter((s) => s._count.testCases > 0).length / sections.length) * 100) : null,
    target,
  };
}

/** Angka Test Summary dari test run, percobaan, bug, dan RTM di jendela sprint. Dibekukan saat difinalkan. */
export async function summaryData(projectId: string, sprint: Sprint) {
  const [runs, bugs, sections] = await Promise.all([
    prisma.testRun.findMany({ where: { projectId, createdAt: inSprintWindow(sprint) }, orderBy: { createdAt: "asc" }, select: { name: true, decision: true, items: { select: { status: true, _count: { select: { attempts: true } } } } } }),
    prisma.bug.findMany({ where: { projectId, sprintId: sprint.id, status: { not: "DRAFT" } }, select: { status: true, severity: true, reopenCount: true } }),
    prisma.requirementSection.findMany({ where: { doc: { projectId } }, select: { title: true, _count: { select: { testCases: true } } } }),
  ]);
  const count = (items: { status: string }[], s: string) => items.filter((i) => i.status === s).length;
  const active = bugs.filter((b) => (OPEN as readonly string[]).includes(b.status));
  return {
    asOf: new Date().toISOString(),
    attempts: runs.reduce((a, r) => a + r.items.reduce((x, i) => x + i._count.attempts, 0), 0),
    runs: runs.map((r) => ({ name: r.name, pass: count(r.items, "PASS"), fail: count(r.items, "FAIL"), blocked: count(r.items, "BLOCKED"), decision: r.decision })),
    bugs: { total: bugs.length, closed: bugs.filter((b) => b.status === "CLOSED").length, active: active.length, activeHigh: active.filter((b) => b.severity === "HIGH" || b.severity === "BLOCKER").length, reopened: bugs.filter((b) => b.reopenCount > 0).length },
    coverage: { sections: sections.length, withTestCase: sections.filter((s) => s._count.testCases > 0).length, noTestCase: sections.filter((s) => !s._count.testCases).map((s) => s.title) },
  };
}
export type SummaryData = Awaited<ReturnType<typeof summaryData>>;

export async function releaseBugs(projectId: string): Promise<NoteBug[]> {
  const bugs = await prisma.bug.findMany({
    where: { projectId, OR: [{ fixedInVersion: { not: null } }, { appVersion: { not: null } }] },
    select: { key: true, title: true, status: true, severity: true, fixedInVersion: true, appVersion: true, assignee: { select: { name: true, email: true } } },
    orderBy: { number: "asc" },
  });
  return bugs.map((b) => ({ ...b, assignee: b.assignee ? (b.assignee.name ?? b.assignee.email) : null }));
}

/** Release notes eksternal untuk portal klien: hanya yang sudah Final, judul tulis-ulang, tanpa nama/catatan internal/Draft/Invalid. */
export async function publishedReleaseNotes(projectId: string) {
  const [docs, bugs] = await Promise.all([
    prisma.stlcDoc.findMany({ where: { projectId, kind: "RELEASE_NOTES", status: "FINAL" }, orderBy: { finalizedAt: "desc" }, select: { id: true, title: true, releaseVersion: true, body: true } }),
    releaseBugs(projectId),
  ]);
  return docs.filter((d) => d.releaseVersion).map((d) => {
    const titles = ((d.body as { titles?: Record<string, string> } | null)?.titles ?? {}) as Record<string, string>;
    return { id: d.id, title: d.title, version: d.releaseVersion as string, ...buildReleaseNotes(bugs, d.releaseVersion as string, titles, true) };
  });
}
