import test from "node:test";
import assert from "node:assert/strict";
import { countsOf, EMPTY_COUNTS, testRunState } from "./test-run-state";

const c = (o: Partial<typeof EMPTY_COUNTS>) => ({ ...EMPTY_COUNTS, ...o });

test("a run keeps spinning until nothing is left to run", () => {
  assert.equal(testRunState({ status: "IN_PROGRESS", counts: c({ PASS: 3, NOT_RUN: 1 }), hasActiveLease: true }).kind, "running");
  assert.equal(testRunState({ status: "IN_PROGRESS", counts: c({ NOT_RUN: 4 }), hasActiveLease: false }).kind, "waiting");
  // a failure does not stop the spinner while items remain, the failure shows once the run is done
  assert.equal(testRunState({ status: "IN_PROGRESS", counts: c({ FAIL: 1, NOT_RUN: 2 }), hasActiveLease: false }).kind, "waiting");
});

test("finished runs are green or red like a CI check", () => {
  assert.equal(testRunState({ status: "IN_PROGRESS", counts: c({ PASS: 3, SKIPPED: 1 }), hasActiveLease: false }).kind, "passed");
  assert.equal(testRunState({ status: "IN_PROGRESS", counts: c({ PASS: 3, BLOCKED: 1 }), hasActiveLease: false }).kind, "failed");
  assert.equal(testRunState({ status: "COMPLETED", decision: "PASS_WITH_NOTES", counts: c({ PASS: 2, FAIL: 1 }), hasActiveLease: false }).kind, "passed");
  assert.equal(testRunState({ status: "COMPLETED", decision: "FAIL", counts: c({ PASS: 2 }), hasActiveLease: false }).kind, "failed");
  assert.equal(testRunState({ status: "COMPLETED", counts: c({ PASS: 1, FAIL: 1 }), hasActiveLease: false }).kind, "failed");
});

test("progress numbers and empty runs", () => {
  const s = testRunState({ status: "IN_PROGRESS", counts: c({ PASS: 2, FAIL: 1, NOT_RUN: 3 }), hasActiveLease: false });
  assert.deepEqual([s.done, s.total, s.red], [3, 6, true]);
  assert.equal(testRunState({ status: "IN_PROGRESS", counts: c({}), hasActiveLease: false }).kind, "empty");
  assert.deepEqual(countsOf([{ status: "PASS" }, { status: "FAIL" }, { status: "WEIRD" }, { status: "PASS" }]), c({ PASS: 2, FAIL: 1 }));
});
