import test from "node:test";
import assert from "node:assert/strict";
import { coverageOf, dorChecks, nextStatus, parseRequirementSections } from "./requirement";

test("parseRequirementSections: anchor unik, kriteria, hash berubah", () => {
  const a = "# PRD\n## Impor\nteks\n**Kriteria penerimaan**\n- A\n- B\n## Impor\nlain";
  const s = parseRequirementSections(a);
  assert.deepEqual(s.map((x) => x.anchor), ["prd", "impor", "impor-2"]);
  assert.deepEqual(s[1].criteria, ["A", "B"]);
  assert.notEqual(parseRequirementSections(a.replace("teks", "baru"))[1].hash, s[1].hash);
});

test("dorChecks + coverageOf + nextStatus", () => {
  assert.equal(dorChecks({ versionApproved: true, criteria: ["x"], moduleMarked: true, testCaseCount: 0 }).ready, false);
  assert.equal(dorChecks({ versionApproved: true, criteria: ["x"], moduleMarked: true, testCaseCount: 1 }).ready, true);
  const p = { result: "PASS" as const, needsRerun: false };
  assert.equal(coverageOf([], 0), "NO_TC");
  assert.equal(coverageOf([p, p], 0), "VERIFIED");
  assert.equal(coverageOf([p, p], 1), "FAILED");
  assert.equal(coverageOf([p, { ...p, needsRerun: true }], 0), "RECHECK");
  assert.equal(coverageOf([p, { result: "NOT_RUN", needsRerun: false }], 0), "UNTESTED");
  assert.equal(nextStatus("READY", false, "NO_TC", true), "IN_SPRINT");
  assert.equal(nextStatus("DEV_DONE", false, "VERIFIED", true), "VERIFIED");
  assert.equal(nextStatus("APPROVED", false, "VERIFIED", false), "APPROVED");
  assert.equal(nextStatus("VERIFIED", true, "VERIFIED", true), "APPROVED");
});
