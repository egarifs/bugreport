import type { BugSeverity } from "@prisma/client";

export type TrendBug = { id: string; createdAt: Date; severity: BugSeverity; moduleName: string | null; reopenCount: number; dueAt: Date | null; closedAt: Date | null; ended?: boolean };
const WEEK = 7 * 86_400_000;
const SLA_H: Record<BugSeverity, number> = { BLOCKER: 2, HIGH: 8, MEDIUM: 24, LOW: 72 };

/** Hitung tren dari bug + waktu Closed pertama. Murni: tanpa DB. `from`..`to` = rentang laporan. */
export function computeTrend(bugs: TrendBug[], from: Date, to: Date) {
  const n = Math.max(1, Math.ceil((+to - +from) / WEEK));
  const weeks = Array.from({ length: n }, (_, i) => ({ start: new Date(+from + i * WEEK), masuk: 0, selesai: 0 }));
  const at = (d: Date) => Math.floor((+d - +from) / WEEK);
  const inRange = (d: Date) => d >= from && d < to;
  const incoming = bugs.filter((b) => inRange(b.createdAt));
  for (const b of incoming) weeks[Math.min(at(b.createdAt), n - 1)].masuk++;
  const closed = bugs.filter((b) => b.closedAt && inRange(b.closedAt));
  for (const b of closed) weeks[Math.min(at(b.closedAt!), n - 1)].selesai++;

  // Lewat SLA: bug yang dibuat di rentang dan ditutup/masih terbuka melewati tenggat (dueAt, atau createdAt + SLA severity)
  const due = (b: TrendBug) => b.dueAt ?? new Date(+b.createdAt + SLA_H[b.severity] * 3_600_000);
  const late = (b: TrendBug) => (b.closedAt ? b.closedAt > due(b) : !b.ended && to > due(b)); // ended = status akhir selain Closed (Invalid dll): tidak dihitung
  const sev = (["BLOCKER", "HIGH", "MEDIUM", "LOW"] as const).map((s) => {
    const all = incoming.filter((b) => b.severity === s);
    return { severity: s, total: all.length, late: all.filter(late).length };
  });

  const days = closed.map((b) => (+b.closedAt! - +b.createdAt) / 86_400_000).sort((a, b) => a - b);
  const medianDays = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : null;

  const mod = new Map<string, { total: number; reopen: number }>();
  for (const b of incoming) {
    const m = mod.get(b.moduleName ?? "Tanpa modul") ?? { total: 0, reopen: 0 };
    m.total++; if (b.reopenCount > 0) m.reopen++;
    mod.set(b.moduleName ?? "Tanpa modul", m);
  }
  const reopened = incoming.filter((b) => b.reopenCount > 0).length;
  return {
    weeks, sev, medianDays,
    masuk: incoming.length, selesai: closed.length, late: sev.reduce((a, s) => a + s.late, 0),
    reopenRate: incoming.length ? Math.round((reopened / incoming.length) * 100) : 0,
    modules: [...mod].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 5),
  };
}
