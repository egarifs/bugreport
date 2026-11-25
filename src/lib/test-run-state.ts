// Overall state of a test run, shown as a GitHub-style indicator: spinner until it passes, check when green, cross when red.

export type RunKind = "empty" | "running" | "waiting" | "passed" | "failed";

export type RunCounts = { PASS: number; FAIL: number; BLOCKED: number; SKIPPED: number; NOT_RUN: number };

export const EMPTY_COUNTS: RunCounts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0 };

export type RunStateInput = {
  status: "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  decision?: string | null; // PASS | PASS_WITH_NOTES | FAIL once a run is closed
  counts: RunCounts;
  hasActiveLease: boolean; // an agent or person is executing an item right now
};

export const RUN_LABEL: Record<RunKind, string> = {
  empty: "Belum ada test case",
  running: "Sedang dijalankan",
  waiting: "Menunggu dijalankan",
  passed: "Lolos",
  failed: "Gagal",
};

export function countsOf(items: { status: string }[]): RunCounts {
  const c = { ...EMPTY_COUNTS };
  for (const i of items) if (i.status in c) c[i.status as keyof RunCounts]++;
  return c;
}

export function testRunState({ status, decision, counts, hasActiveLease }: RunStateInput) {
  const total = counts.PASS + counts.FAIL + counts.BLOCKED + counts.SKIPPED + counts.NOT_RUN;
  const done = total - counts.NOT_RUN;
  const red = counts.FAIL + counts.BLOCKED > 0;
  let kind: RunKind;
  if (total === 0) kind = "empty";
  else if (status !== "IN_PROGRESS") kind = decision === "FAIL" || (!decision && red) ? "failed" : "passed";
  else if (counts.NOT_RUN > 0) kind = hasActiveLease ? "running" : "waiting"; // not passed yet: keep spinning
  else kind = red ? "failed" : "passed";
  return { kind, label: RUN_LABEL[kind], done, total, red };
}
