import test from "node:test";
import assert from "node:assert/strict";
import { devMetrics, median, periodRange, previousKey, qaMetrics } from "./performance";

const d = (s: string) => new Date(s);

test("periodRange/previousKey/median", () => {
  assert.deepEqual(periodRange("quarter", "2026-Q4"), { from: d("2026-10-01"), to: d("2027-01-01") });
  assert.equal(periodRange("month", "2026-13"), null);
  assert.equal(previousKey("month", "2026-01"), "2025-12");
  assert.equal(previousKey("quarter", "2026-Q1"), "2025-Q4");
  assert.equal(median([3, 1, 2, 10]), 2.5);
  assert.equal(median([]), null);
});

test("qaMetrics: Invalid tidak diterima, Draft diabaikan, agent dipisah", () => {
  const m = qaMetrics({
    casesCreated: 2, newVersions: 1,
    attempts: [{ viaAgent: false }, { viaAgent: true }, { viaAgent: true }],
    reported: [{ status: "CLOSED", severity: "HIGH" }, { status: "INVALID", severity: "LOW" }, { status: "DRAFT", severity: "LOW" }],
    closedBugs: [{ reopenCount: 1 }, { reopenCount: 0 }],
    triaged: [{ createdAt: d("2026-11-01T00:00:00Z"), reviewedAt: d("2026-11-01T02:00:00Z") }],
  });
  assert.equal(m.reported, 2);
  assert.equal(m.acceptedPct, 50);
  assert.equal(m.attemptsAgent, 2);
  assert.equal(m.attemptsManual, 1);
  assert.equal(m.triageMedianHours, 2);
  assert.equal(m.reopenAfterClose, 1);
});

test("devMetrics: on-time, build, reopen, beban", () => {
  const m = devMetrics({
    moved: [
      { severity: "HIGH", at: d("2026-11-02"), dueAt: d("2026-11-03"), fixedInBuild: "b1", reopenCount: 0, startedAt: d("2026-11-01"), closed: true },
      { severity: "LOW", at: d("2026-11-05"), dueAt: d("2026-11-03"), fixedInBuild: null, reopenCount: 1, startedAt: null, closed: false },
    ],
    active: [{ overdue: true }, { overdue: false }],
  });
  assert.equal(m.onTimePct, 50);
  assert.equal(m.buildFilledPct, 50);
  assert.equal(m.reopenRatePct, 50);
  assert.equal(m.medianHoursToVerify, 24);
  assert.equal(m.closedBySeverity.HIGH, 1);
  assert.equal(m.overdueLoad, 1);
});
