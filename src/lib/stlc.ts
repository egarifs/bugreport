import type { BugSeverity, BugStatus } from "@prisma/client";

export const DOD_KEYS = ["BLOCKER", "HIGH", "TEST_RUNS", "REQUIREMENTS", "SUMMARY"] as const;
export type DodKey = (typeof DOD_KEYS)[number];
export const DOD_LABEL: Record<DodKey, string> = {
  BLOCKER: "Semua bug Blocker di sprint ditutup",
  HIGH: "Semua bug High di sprint Closed atau dipindah dengan alasan",
  TEST_RUNS: "Semua test run sprint ditutup dengan keputusan",
  REQUIREMENTS: "Requirement di sprint Terverifikasi",
  SUMMARY: "Test Summary Report dibuat",
};

export interface DodFacts { blockerOpen: string[]; highOpen: string[]; runsOpen: string[]; reqNotVerified: string[]; hasSummary: boolean }
export interface DodItem { key: DodKey; label: string; ok: boolean; detail: string }

/** Checklist DoD dari fakta sprint; hanya butir yang diaktifkan Admin yang dihitung. */
export function dodChecklist(enabled: readonly string[], f: DodFacts): DodItem[] {
  const list = (a: string[]) => (a.length ? `${a.length} tersisa: ${a.slice(0, 5).join(", ")}` : "");
  const all: DodItem[] = [
    { key: "BLOCKER", label: DOD_LABEL.BLOCKER, ok: !f.blockerOpen.length, detail: list(f.blockerOpen) },
    { key: "HIGH", label: DOD_LABEL.HIGH, ok: !f.highOpen.length, detail: list(f.highOpen) },
    { key: "TEST_RUNS", label: DOD_LABEL.TEST_RUNS, ok: !f.runsOpen.length, detail: list(f.runsOpen) },
    { key: "REQUIREMENTS", label: DOD_LABEL.REQUIREMENTS, ok: !f.reqNotVerified.length, detail: list(f.reqNotVerified) },
    { key: "SUMMARY", label: DOD_LABEL.SUMMARY, ok: f.hasSummary, detail: f.hasSummary ? "" : "belum dibuat" },
  ];
  return all.filter((i) => enabled.includes(i.key));
}

/** Boleh tutup bila semua hijau, atau ada alasan pengecualian bila ada butir merah. */
export function closeVerdict(items: DodItem[], reason: string): { ok: boolean; exception: boolean; error?: string } {
  const red = items.some((i) => !i.ok);
  if (!red) return { ok: true, exception: false };
  if (!reason.trim()) return { ok: false, exception: true, error: "Ada butir DoD yang belum terpenuhi. Isi alasan pengecualian untuk tetap menutup." };
  return { ok: true, exception: true };
}

export interface ExitFacts { blockersOpen: string[]; highOpen: string[]; coveragePct: number | null; target: number }
/** Kriteria keluar Test Plan: informatif, tidak memblokir rilis. */
export function exitStatus(f: ExitFacts) {
  return [
    { ok: !f.blockersOpen.length, text: f.blockersOpen.length ? `${f.blockersOpen.length} Blocker terbuka (${f.blockersOpen.join(", ")})` : "0 Blocker terbuka" },
    { ok: !f.highOpen.length, text: f.highOpen.length ? `${f.highOpen.length} High terbuka (${f.highOpen.join(", ")})` : "0 High terbuka" },
    { ok: f.coveragePct !== null && f.coveragePct >= f.target, text: `Cakupan ${f.coveragePct === null ? "—" : `${f.coveragePct}%`} (target ${f.target}%)` },
  ];
}

export interface NoteBug { key: string; title: string; status: BugStatus; severity: BugSeverity; assignee: string | null; fixedInVersion: string | null; appVersion: string | null }
const HIDDEN: readonly BugStatus[] = ["DRAFT", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];
const ACTIVE: readonly BugStatus[] = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED"];

/** Isi release notes: Perbaikan = Closed dengan fixedInVersion = versi; Masalah diketahui = Blocker/High aktif yang ditemukan di versi itu. Eksternal: judul ditulis ulang, tanpa nama/Draft/Invalid. */
export function buildReleaseNotes(bugs: NoteBug[], version: string, titles: Record<string, string>, external: boolean) {
  const shown = (b: NoteBug) => !(external && HIDDEN.includes(b.status));
  const line = (b: NoteBug) => ({
    key: b.key,
    text: external ? (titles[b.key]?.trim() || b.title) : b.title,
    meta: external ? "" : `${b.key} · ${b.severity}${b.assignee ? ` · ${b.assignee}` : ""}`,
  });
  return {
    fixes: bugs.filter((b) => b.status === "CLOSED" && b.fixedInVersion === version && shown(b)).map(line),
    known: bugs.filter((b) => ACTIVE.includes(b.status) && b.appVersion === version && (b.severity === "BLOCKER" || b.severity === "HIGH")).map(line),
  };
}
