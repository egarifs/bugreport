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
  assert.deepEqual(f.status, []);
  assert.deepEqual(f.severity, ["HIGH"]);
  assert.equal(f.q, "login");
  assert.equal(f.page, 1);
  assert.deepEqual(f.assigneeIds, []);
  assert.deepEqual(f.moduleIds, ["m1"]);
  assert.equal(parseBugListFilters({ view: "all", page: "4" }, "review").page, 4);
  assert.equal(parseBugListFilters({ layout: "board" }, "all").layout, "board");
  assert.equal(parseBugListFilters({ layout: "x" }, "all").layout, "list");
  assert.equal(parseBugListFilters({ layout: "board" }, "review").view, "all");
  assert.equal(parseBugListFilters({ layout: "board", view: "mine" }, "review").view, "mine");
});

test("buildBugWhere scopes to the project and ANDs every clause", () => {
  const f = parseBugListFilters({ view: "review", severity: "BLOCKER,HIGH,BOGUS,HIGH", q: "CRM-1", reporter: "r1" }, "all");
  const where = buildBugWhere(f, ctx);
  assert.equal(where.projectId, "p1");
  const and = where.AND as object[];
  assert.deepEqual(and[0], { status: "DRAFT" });
  assert.ok(and.some((c) => JSON.stringify(c) === JSON.stringify({ severity: { in: ["BLOCKER", "HIGH"] } })));
  assert.ok(and.some((c) => JSON.stringify(c) === JSON.stringify({ reporterId: { in: ["r1"] } })));
  assert.ok(and.some((c) => "OR" in c)); // search
  // a status filter cannot widen the "mine" tab: both clauses are kept side by side
  const mine = buildBugWhere(parseBugListFilters({ view: "mine", status: "CLOSED" }, "all"), ctx).AND as object[];
  assert.equal(mine.length, 2);
});

test("assignee filter supports the unassigned bucket", () => {
  const and = buildBugWhere(parseBugListFilters({ view: "all", assignee: UNASSIGNED }, "all"), ctx).AND as object[];
  assert.deepEqual(and[1], { OR: [{ assigneeId: null, bugAssignees: { none: {} } }] });
  const mixed = buildBugWhere(parseBugListFilters({ view: "all", assignee: `u2,${UNASSIGNED}` }, "all"), ctx).AND as object[];
  assert.equal(((mixed[1] as { OR: object[] }).OR).length, 3);
});

test("pageWindow clamps and reports the visible range", () => {
  assert.deepEqual(pageWindow(1, 0), { current: 1, pages: 1, skip: 0, take: 25, from: 0, to: 0 });
  const w = pageWindow(99, 60);
  assert.equal(w.current, 3);
  assert.equal(w.from, 51);
  assert.equal(w.to, 60);
});

test("bugListHref keeps filters, applies overrides, drops empties", () => {
  const f = parseBugListFilters({ view: "all", severity: "HIGH,LOW", q: "a b", page: "2" }, "all");
  assert.equal(bugListHref("CRM", f, { page: "3" }), "/projects/CRM?view=all&q=a+b&severity=HIGH%2CLOW&page=3");
  assert.equal(bugListHref("CRM", f, { severity: undefined, q: undefined, page: undefined }), "/projects/CRM?view=all");
  assert.equal(isFiltered(f), true);
  assert.equal(isFiltered(parseBugListFilters({}, "all")), false);
});

test("board column limit survives in the URL only when raised", () => {
  const f = parseBugListFilters({ layout: "board", cols: "50" }, "all");
  assert.equal(f.cols, 50);
  assert.equal(bugListHref("CRM", f), "/projects/CRM?view=all&layout=board&cols=50");
  assert.equal(bugListHref("CRM", parseBugListFilters({ layout: "board" }, "all")), "/projects/CRM?view=all&layout=board");
});

test("tag filter matches any selected tag and survives in the URL", () => {
  const f = parseBugListFilters({ view: "all", tag: "t1,t2" }, "all");
  assert.deepEqual(f.tagIds, ["t1", "t2"]);
  assert.ok((buildBugWhere(f, ctx).AND as object[]).some((c) => JSON.stringify(c) === JSON.stringify({ tags: { some: { id: { in: ["t1", "t2"] } } } })));
  assert.equal(isFiltered(f), true);
  assert.equal(bugListHref("CRM", f), "/projects/CRM?view=all&tag=t1%2Ct2");
});
