import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBugs } from "./project-overview";

test("summarizeBugs: aktif, penghalang rilis, draf; Closed dan Invalid tidak dihitung", () => {
  const s = summarizeBugs([
    { status: "OPEN", severity: "HIGH", n: 2 },
    { status: "IN_PROGRESS", severity: "LOW", n: 1 },
    { status: "REOPENED", severity: "BLOCKER", n: 1 },
    { status: "DRAFT", severity: "HIGH", n: 3 },
    { status: "CLOSED", severity: "BLOCKER", n: 5 },
    { status: "INVALID", severity: "HIGH", n: 1 },
  ]);
  assert.deepEqual(s, { active: 4, blockers: 3, drafts: 3 });
});
