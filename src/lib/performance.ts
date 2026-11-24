import type { BugSeverity } from "@prisma/client";

export type PeriodType = "sprint" | "month" | "quarter";
const REJECTED = ["INVALID", "DUPLICATE", "CANNOT_REPRODUCE"];
const HOUR = 3_600_000;

/** Rentang periode dari kunci: month "2026-11", quarter "2026-Q4". Zona UTC agar deterministik. */
export function periodRange(type: Exclude<PeriodType, "sprint">, key: string): { from: Date; to: Date } | null {
  if (type === "month") {
    const m = /^(\d{4})-(\d{2})$/.exec(key); if (!m || +m[2] < 1 || +m[2] > 12) return null;
    return { from: new Date(Date.UTC(+m[1], +m[2] - 1, 1)), to: new Date(Date.UTC(+m[1], +m[2], 1)) };
  }
  const q = /^(\d{4})-Q([1-4])$/.exec(key); if (!q) return null;
  return { from: new Date(Date.UTC(+q[1], (+q[2] - 1) * 3, 1)), to: new Date(Date.UTC(+q[1], +q[2] * 3, 1)) };
}
export function previousKey(type: Exclude<PeriodType, "sprint">, key: string): string | null {
  const r = periodRange(type, key); if (!r) return null;
  const d = new Date(+r.from - 1);
  return type === "month" ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export interface QaInput {
  casesCreated: number; newVersions: number;
  attempts: { viaAgent: boolean; imported?: boolean }[];
  reported: { status: string; severity: BugSeverity }[];
  closedBugs: { reopenCount: number }[];
  triaged: { createdAt: Date; reviewedAt: Date }[];
}
export function qaMetrics(i: QaInput) {
  const live = i.reported.filter((b) => b.status !== "DRAFT");
  const sev = (s: BugSeverity) => live.filter((b) => b.severity === s).length;
  return {
    casesCreated: i.casesCreated, newVersions: i.newVersions,
    attemptsManual: i.attempts.filter((a) => !a.viaAgent && !a.imported).length,
    attemptsAgent: i.attempts.filter((a) => a.viaAgent).length,
    attemptsImported: i.attempts.filter((a) => !a.viaAgent && a.imported).length,
    reported: live.length,
    acceptedPct: live.length ? Math.round((live.filter((b) => !REJECTED.includes(b.status)).length / live.length) * 100) : null,
    severity: { BLOCKER: sev("BLOCKER"), HIGH: sev("HIGH"), MEDIUM: sev("MEDIUM"), LOW: sev("LOW") },
    closed: i.closedBugs.length,
    triageMedianHours: median(i.triaged.map((t) => (+t.reviewedAt - +t.createdAt) / HOUR)),
    reopenAfterClose: i.closedBugs.filter((b) => b.reopenCount > 0).length,
  };
}

export interface DevMoved { severity: BugSeverity; at: Date; dueAt: Date | null; fixedInBuild: string | null; reopenCount: number; startedAt: Date | null; closed: boolean }
export interface DevInput { moved: DevMoved[]; active: { overdue: boolean }[] }
export function devMetrics(i: DevInput) {
  const by = (pred: (m: DevMoved) => boolean) => ({ BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0, ...Object.fromEntries((["BLOCKER", "HIGH", "MEDIUM", "LOW"] as const).map((s) => [s, i.moved.filter((m) => m.severity === s && pred(m)).length])) }) as Record<BugSeverity, number>;
  const withDue = i.moved.filter((m) => m.dueAt);
  return {
    movedTotal: i.moved.length,
    toVerifyBySeverity: by(() => true),
    closedBySeverity: by((m) => m.closed),
    buildFilledPct: i.moved.length ? Math.round((i.moved.filter((m) => m.fixedInBuild).length / i.moved.length) * 100) : null,
    medianHoursToVerify: median(i.moved.filter((m) => m.startedAt).map((m) => (+m.at - +m.startedAt!) / HOUR)),
    onTimePct: withDue.length ? Math.round((withDue.filter((m) => m.at <= m.dueAt!).length / withDue.length) * 100) : null,
    reopenRatePct: i.moved.length ? Math.round((i.moved.filter((m) => m.reopenCount > 0).length / i.moved.length) * 100) : null,
    activeLoad: i.active.length, overdueLoad: i.active.filter((a) => a.overdue).length,
  };
}

/** Definisi tiap metrik: satu sumber untuk tooltip (i) dan PDF. */
export const METRIC_DEF: Record<string, string> = {
  casesCreated: "Test case yang versi 1-nya dibuat orang ini di periode.",
  newVersions: "Versi baru (v2 dan seterusnya) test case yang dibuat orang ini.",
  attemptsManual: "Percobaan test run yang dijalankan manual (bukan agent).",
  attemptsAgent: "Percobaan yang dijalankan lewat agent QA lokal. Dihitung terpisah dari manual.",
  reported: "Bug yang dilaporkan orang ini, tanpa Draft.",
  acceptedPct: "Bug dilaporkan yang tidak berakhir Invalid, Duplicate, atau Cannot reproduce.",
  closed: "Bug yang ditutup (Closed) oleh orang ini di periode.",
  triageMedianHours: "Median jam dari bug dibuat sampai direview, hanya bila orang ini yang mereview.",
  reopenAfterClose: "Bug yang ditutup orang ini dan kemudian dibuka ulang.",
  movedTotal: "Bug yang orang ini pindahkan ke Perlu verifikasi di periode.",
  buildFilledPct: "Persentase bug yang dipindahkan dengan build perbaikan terisi.",
  medianHoursToVerify: "Median jam dari In progress pertama sampai Perlu verifikasi.",
  onTimePct: "Persentase bug yang dipindahkan ke Perlu verifikasi sebelum tenggat (hanya bug bertenggat).",
  reopenRatePct: "Bug yang kemudian dibuka ulang dibagi total yang orang ini pindahkan ke Perlu verifikasi.",
  activeLoad: "Bug aktif yang saat ini ditugaskan ke orang ini.",
  overdueLoad: "Dari bug aktif, yang sudah lewat tenggat.",
};
