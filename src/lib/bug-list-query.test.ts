import test from "node:test";
import assert from "node:assert/strict";
import { buildBugWhere, bugListHref, isFiltered, pageWindow, parseBugListFilters, UNASSIGNED } from "./bug-list-query";

const ctx = { projectId: "p1", userId: "u1" };

test("parseBugListFilters drops invalid input and keeps valid values", () => {
  const f = parseBugListFilters(
    { view: "bogus", status: "NOPE", severity: "HIGH", q: "  login  ", page: "-3", assignee: "x".repeat(200), module: "m1" },
    "mine",
  );
  assert.equal(f.view, "mine");
  assert.equal(f.status, undefined);
  assert.equal(f.severity, "HIGH");
  assert.equal(f.q, "login");
  assert.equal(f.page, 1);
  assert.equal(f.assigneeId, undefined);
  assert.equal(f.moduleId, "m1");
  assert.equal(parseBugListFilters({ view: "all", page: "4" }, "review").page, 4);
});

test("buildBugWhere scopes to the project and ANDs every clause", () => {
  const f = parseBugListFilters({ view: "review", severity: "BLOCKER", q: "CRM-1", reporter: "r1" }, "all");
  const where = buildBugWhere(f, ctx);
  assert.equal(where.projectId, "p1");
  const and = where.AND as object[];
  assert.deepEqual(and[0], { status: "DRAFT" });
  assert.ok(and.some((c) => JSON.stringify(c) === JSON.stringify({ severity: "BLOCKER" })));
  assert.ok(and.some((c) => JSON.stringify(c) === JSON.stringify({ reporterId: "r1" })));
  assert.ok(and.some((c) => "OR" in c)); // search
  // a status filter cannot widen the "mine" tab: both clauses are kept side by side
  const mine = buildBugWhere(parseBugListFilters({ view: "mine", status: "CLOSED" }, "all"), ctx).AND as object[];
  assert.equal(mine.length, 2);
});

test("assignee filter supports the unassigned bucket", () => {
  const and = buildBugWhere(parseBugListFilters({ view: "all", assignee: UNASSIGNED }, "all"), ctx).AND as object[];
  assert.deepEqual(and[1], { assigneeId: null, bugAssignees: { none: {} } });
});

test("pageWindow clamps and reports the visible range", () => {
  assert.deepEqual(pageWindow(1, 0), { current: 1, pages: 1, skip: 0, take: 25, from: 0, to: 0 });
  const w = pageWindow(99, 60);
  assert.equal(w.current, 3);
  assert.equal(w.from, 51);
  assert.equal(w.to, 60);
});

test("bugListHref keeps filters, applies overrides, drops empties", () => {
  const f = parseBugListFilters({ view: "all", severity: "HIGH", q: "a b", page: "2" }, "all");
  assert.equal(bugListHref("CRM", f, { page: "3" }), "/projects/CRM?view=all&q=a+b&severity=HIGH&page=3");
  assert.equal(bugListHref("CRM", f, { severity: undefined, q: undefined, page: undefined }), "/projects/CRM?view=all");
  assert.equal(isFiltered(f), true);
  assert.equal(isFiltered(parseBugListFilters({}, "all")), false);
});
