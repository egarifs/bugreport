import type { BugPriority, BugSeverity, BugStatus } from "@prisma/client";

export type SummaryBug = { status: BugStatus; severity: BugSeverity; moduleName: string | null; createdAt: Date; priority?: BugPriority };

const DAY = 86_400_000;
export const SEVERITIES: readonly BugSeverity[] = ["BLOCKER", "HIGH", "MEDIUM", "LOW"];
/** Urutan alur status untuk grafik distribusi. Draft tidak dihitung. */
export const FLOW: readonly BugStatus[] = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED", "CLOSED"];
const REJECTED: readonly BugStatus[] = ["INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];
const ACTIVE: readonly BugStatus[] = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED"];
export const AGE_BUCKETS = ["< 3 hari", "3–7 hari", "7–14 hari", "> 14 hari"] as const;

const bucket = (days: number) => (days < 3 ? 0 : days < 7 ? 1 : days < 14 ? 2 : 3);

/** Hitung data grafik Ringkasan. Murni: tanpa DB. Passed = CLOSED, Open = bug aktif. */
export function computeSummary(bugs: SummaryBug[], now: Date) {
  const live = bugs.filter((b) => b.status !== "DRAFT");
  const status = [...FLOW, "REJECTED" as const].map((s) => ({
    key: s,
    count: live.filter((b) => (s === "REJECTED" ? REJECTED.includes(b.status) : b.status === s)).length,
  }));
  const severity = SEVERITIES.map((s) => ({ key: s, count: live.filter((b) => b.severity === s).length }));

  const mods = new Map<string, { open: number; passed: number }>();
  for (const b of live) {
    const isOpen = ACTIVE.includes(b.status);
    if (!isOpen && b.status !== "CLOSED") continue;
    const m = mods.get(b.moduleName ?? "Tanpa modul") ?? { open: 0, passed: 0 };
    if (isOpen) m.open++; else m.passed++;
    mods.set(b.moduleName ?? "Tanpa modul", m);
  }
  const modules = [...mods].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.open + b.passed - (a.open + a.passed) || a.name.localeCompare(b.name));

  const active = live.filter((b) => ACTIVE.includes(b.status));
  const openByStatus = ACTIVE.map((s) => ({
    key: s,
    bySeverity: Object.fromEntries(SEVERITIES.map((v) => [v, active.filter((b) => b.status === s && b.severity === v).length])) as Record<BugSeverity, number>,
  }));
  const age = AGE_BUCKETS.map((label, i) => ({
    label,
    bySeverity: Object.fromEntries(SEVERITIES.map((v) => [v, active.filter((b) => b.severity === v && bucket(Math.max(0, (+now - +b.createdAt) / DAY)) === i).length])) as Record<BugSeverity, number>,
  }));
  const priority = (["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((k) => ({
    key: k,
    open: active.filter((b) => b.priority === k).length,
    passed: live.filter((b) => b.priority === k && b.status === "CLOSED").length,
  }));
  return { total: live.length, priority, status, severity, modules, openByStatus, age };
}

const WEEK = 7 * DAY;

/** Bug ditemukan per minggu dalam rentang [from, to). */
export function foundPerWeek(createdAts: Date[], from: Date, to: Date) {
  const n = Math.max(1, Math.ceil((+to - +from) / WEEK));
  const weeks = Array.from({ length: n }, (_, i) => ({ start: new Date(+from + i * WEEK), count: 0 }));
  for (const d of createdAts) if (d >= from && d < to) weeks[Math.min(n - 1, Math.floor((+d - +from) / WEEK))].count++;
  return weeks;
}

/** Burn-down: sisa (dibuat - ditutup) per hari + garis ideal linear ke 0 di akhir. closedAt = null jika belum Closed. */
export function burndown(bugs: { createdAt: Date; closedAt: Date | null }[], from: Date, to: Date) {
  const days = Math.max(1, Math.ceil((+to - +from) / DAY));
  const remainAt = (t: number) => bugs.filter((b) => +b.createdAt <= t && !(b.closedAt && +b.closedAt <= t)).length;
  const start = remainAt(+from + DAY);
  return Array.from({ length: days }, (_, i) => ({
    day: new Date(+from + i * DAY),
    remaining: remainAt(+from + (i + 1) * DAY),
    ideal: Math.round((start * (days - 1 - i)) / Math.max(1, days - 1) * 10) / 10,
  }));
}

/** Bug aktif per orang, bertumpuk per severity; "Belum ditugaskan" untuk bug tanpa assignee. Urut nama, tanpa peringkat. */
export function workload(bugs: { severity: BugSeverity; assignees: string[] }[]) {
  const m = new Map<string, Record<BugSeverity, number>>();
  const add = (n: string, s: BugSeverity) => {
    const r = m.get(n) ?? { BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    r[s]++; m.set(n, r);
  };
  for (const b of bugs) for (const a of b.assignees.length ? b.assignees : ["Belum ditugaskan"]) add(a, b.severity);
  return [...m].map(([name, bySeverity]) => ({ name, bySeverity })).sort((a, b) => a.name.localeCompare(b.name));
}
