import { createHash } from "node:crypto";
import type { RequirementStatus } from "@prisma/client";

export interface ParsedSection { anchor: string; title: string; hash: string; criteria: string[] }

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bagian";

/** Pecah markdown per heading; kriteria penerimaan = bullet di bawah heading "Kriteria penerimaan". Anchor unik per dokumen. */
export function parseRequirementSections(md: string): ParsedSection[] {
  const out: { title: string; lines: string[] }[] = [];
  for (const line of md.split("\n")) {
    const h = /^#{1,4}\s+(.*)/.exec(line);
    if (h) out.push({ title: h[1].trim(), lines: [] });
    else if (out.length) out[out.length - 1].lines.push(line);
  }
  const seen = new Map<string, number>();
  return out.filter((s) => !/^kriteria penerimaan$/i.test(s.title)).map((s, i) => {
    const base = slug(s.title);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    // Kriteria penerimaan bagian ini: bullet setelah baris "Kriteria penerimaan" (tebal/heading) di dalam isi.
    const body = s.lines.join("\n");
    const at = body.search(/kriteria penerimaan/i);
    const criteria = at < 0 ? [] : body.slice(at).split("\n").slice(1).map((l) => /^\s*[-*]\s+(.*)/.exec(l)?.[1]?.trim() ?? "").filter(Boolean);
    void i;
    return { anchor: n > 1 ? `${base}-${n}` : base, title: s.title, hash: createHash("sha1").update(body.trim()).digest("hex"), criteria };
  });
}

export interface DorInput { versionApproved: boolean; criteria: string[]; moduleMarked: boolean; testCaseCount: number }
export const DOR_LABELS = ["Versi dokumen disetujui", "Kriteria penerimaan terisi", "Dampak ke modul ditandai", "Minimal 1 test case merujuk bagian ini"] as const;
export function dorChecks(i: DorInput) {
  const ok = [i.versionApproved, i.criteria.length > 0, i.moduleMarked, i.testCaseCount > 0];
  return { items: DOR_LABELS.map((label, n) => ({ label, ok: ok[n] })), ready: ok.every(Boolean) };
}

export type Coverage = "VERIFIED" | "FAILED" | "UNTESTED" | "NO_TC" | "RECHECK";
export interface CaseState { result: "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN" | "SKIPPED"; needsRerun: boolean }

/** Status cakupan satu bagian dari hasil terakhir tiap test case + jumlah bug terbuka. */
export function coverageOf(cases: CaseState[], openBugs: number): Coverage {
  if (!cases.length) return "NO_TC";
  if (openBugs > 0 || cases.some((c) => c.result === "FAIL" || c.result === "BLOCKED")) return "FAILED";
  if (cases.some((c) => c.needsRerun)) return "RECHECK";
  if (cases.every((c) => c.result === "PASS")) return "VERIFIED";
  return "UNTESTED";
}

/** Status requirement setelah sinkron: VERIFIED otomatis; revisi isi => APPROVED. */
export function nextStatus(cur: RequirementStatus, hashChanged: boolean, cov: Coverage, inSprint: boolean): RequirementStatus {
  if (hashChanged) return "APPROVED";
  if (cov === "VERIFIED" && cur !== "APPROVED") return "VERIFIED";
  if (cur === "VERIFIED") return inSprint ? "IN_SPRINT" : "READY";
  if (cur === "READY" && inSprint) return "IN_SPRINT";
  return cur;
}
