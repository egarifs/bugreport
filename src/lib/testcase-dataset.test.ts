import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Case = { code: string; title: string; module: string; priority: string; steps: string; expectedResult: string; precondition: string };
const data = JSON.parse(readFileSync(resolve(process.cwd(), "docs/testcases/bugreport.json"), "utf8")) as {
  project: { key: string }; modules: string[]; testCases: Case[];
};

test("bugreport test case dataset is complete, unique and secret-free", () => {
  assert.equal(data.project.key, "BGR");
  const codes = data.testCases.map((t) => t.code);
  assert.equal(new Set(codes).size, codes.length, "duplicate code");
  for (const t of data.testCases) {
    assert.match(t.code, /^TC-[A-Z]+-\d{3}$/, t.code);
    assert.ok(t.title.trim() && t.steps.trim() && t.expectedResult.trim(), `${t.code}: title, steps, and expected result are required`);
    assert.ok(data.modules.includes(t.module), `${t.code}: unknown module ${t.module}`);
    assert.ok(["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(t.priority), `${t.code}: bad priority`);
    assert.match(t.steps, /^1\) /, `${t.code}: steps must be numbered`);
    assert.doesNotMatch(JSON.stringify(t), /br_live_|password\s*[:=]/i, `${t.code}: looks like it contains a secret`);
  }
  // every module has at least one case, so the project stays covered as modules are added
  for (const m of data.modules) assert.ok(data.testCases.some((t) => t.module === m), `module ${m} has no test case`);
});
