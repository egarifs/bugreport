import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_STEPS, GUIDE_ROLES, eventsFromFacts, isGuideRole, progressOf } from "./onboarding";

test("eventsFromFacts + progressOf per peran", () => {
  const ev = eventsFromFacts({ bugsCreated: 1, statusChanges: 0, comments: 2, attempts: 0 });
  assert.deepEqual(ev, ["sandbox.bug_created", "sandbox.comment_added"]);
  const p = progressOf("CLIENT", ev);
  assert.equal(p.done, 2); assert.equal(p.total, 2);
  assert.equal(progressOf("QA", ev).done, 2);
  assert.equal(progressOf("QA", ev).total, 4);
  assert.equal(progressOf(null, []).done, 0);
});

test("isGuideRole menolak nilai luar; setiap peran punya langkah", () => {
  assert.equal(isGuideRole("QA"), true);
  assert.equal(isGuideRole("SUPERUSER"), false);
  assert.equal(isGuideRole(undefined), false);
  for (const r of GUIDE_ROLES) assert.ok(ROLE_STEPS[r].length > 0);
});
