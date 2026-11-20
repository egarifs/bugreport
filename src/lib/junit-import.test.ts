import test from "node:test";
import assert from "node:assert/strict";
import { parseJUnit } from "./junit-import";

test("parseJUnit maps codes and outcomes", () => {
  const result = parseJUnit(`<testsuite><testcase name="Login CRM-12"/><testcase name="Checkout CRM-13"><failure>500 error</failure></testcase><testcase name="Search CRM-14"><skipped message="data missing"/></testcase></testsuite>`);
  assert.deepEqual(result.map((item) => [item.code, item.result]), [["CRM-12", "PASS"], ["CRM-13", "FAIL"], ["CRM-14", "SKIPPED"]]);
  assert.equal(result[2].skippedReason, "data missing");
});

test("parseJUnit handles hyphenated codes and self-closing failure", () => {
  const [c] = parseJUnit('<testsuite><testcase name="TC-CRM-001 login"><failure message="boom"/></testcase></testsuite>');
  assert.deepEqual([c.code, c.result, c.actualResult], ["TC-CRM-001", "FAIL", "boom"]);
});
