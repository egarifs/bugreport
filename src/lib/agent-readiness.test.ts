import test from "node:test";
import assert from "node:assert/strict";
import { agentReadiness, fillTestData } from "./agent-readiness";

const base = { status: "READY", steps: "1) buka {{url}} 2) isi {{kontak}}", expectedResult: "ok", testData: { url: "/k", kontak: "Budi" } };

test("agentReadiness", () => {
  assert.deepEqual(agentReadiness(base), { ready: true, missing: [] });
  assert.equal(agentReadiness({ ...base, status: "DRAFT" }).ready, false);
  assert.equal(agentReadiness({ ...base, expectedResult: " " }).ready, false);
  assert.match(agentReadiness({ ...base, testData: { url: "/k" } }).missing[0], /kontak/);
  assert.match(agentReadiness({ ...base, testData: { ...base.testData, adminPassword: "x" } }).missing[0], /adminPassword/);
  assert.equal(agentReadiness({ ...base, testData: null }).ready, false);
  assert.equal(fillTestData(base.steps, base.testData), "1) buka /k 2) isi Budi");
  assert.equal(fillTestData("{{x}}", {}), "{{x}}");
});
