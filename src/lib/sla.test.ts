import test from "node:test";
import assert from "node:assert/strict";
import { calculateBugSla } from "./sla";
import { BugSeverity, BugStatus } from "@prisma/client";

test("SLA: DRAFT and CLOSED return NOT_APPLICABLE", () => {
  const now = new Date();
  const draftSla = calculateBugSla(BugSeverity.BLOCKER, BugStatus.DRAFT, now, now);
  assert.equal(draftSla.status, "NOT_APPLICABLE");
  assert.equal(draftSla.isBreached, false);

  const closedSla = calculateBugSla(BugSeverity.BLOCKER, BugStatus.CLOSED, now, now);
  assert.equal(closedSla.status, "NOT_APPLICABLE");
  assert.equal(closedSla.isBreached, false);
});

test("SLA: BLOCKER breaches after 2 hours", () => {
  const baseTime = new Date("2026-10-30T10:00:00Z");
  
  // 1 hour in -> SAFE (1 hour remaining)
  const at1h = new Date("2026-10-30T11:00:00Z");
  const sla1h = calculateBugSla(BugSeverity.BLOCKER, BugStatus.OPEN, baseTime, at1h);
  assert.equal(sla1h.status, "SAFE");
  assert.equal(sla1h.isBreached, false);
  assert.equal(sla1h.label, "1.0j");

  // 1h 40m in -> WARNING (less than 30m remaining)
  const at1h40m = new Date("2026-10-30T11:40:00Z");
  const slaWarn = calculateBugSla(BugSeverity.BLOCKER, BugStatus.IN_PROGRESS, baseTime, at1h40m);
  assert.equal(slaWarn.status, "WARNING");
  assert.equal(slaWarn.isWarning, true);
  assert.equal(slaWarn.label, "20m");

  // 2h 30m in -> BREACHED (+30m overdue)
  const at2h30m = new Date("2026-10-30T12:30:00Z");
  const slaBreached = calculateBugSla(BugSeverity.BLOCKER, BugStatus.OPEN, baseTime, at2h30m);
  assert.equal(slaBreached.status, "BREACHED");
  assert.equal(slaBreached.isBreached, true);
  assert.equal(slaBreached.label, "+30m");
});

test("SLA: HIGH breaches after 8 hours", () => {
  const baseTime = new Date("2026-10-30T00:00:00Z");
  const at9h = new Date("2026-10-30T09:00:00Z");
  const sla = calculateBugSla(BugSeverity.HIGH, BugStatus.OPEN, baseTime, at9h);
  assert.equal(sla.status, "BREACHED");
  assert.equal(sla.label, "+1.0j");
});
