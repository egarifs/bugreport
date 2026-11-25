import test from "node:test";
import assert from "node:assert/strict";
import { boardLimit, columnOf, dragTargets, needsDetailPage } from "./bug-board";

test("drag never covers moves that need the detail page", () => {
  assert.equal(needsDetailPage("DRAFT", "OPEN"), true);
  assert.equal(needsDetailPage("READY_FOR_VERIFICATION", "CLOSED"), true);
  assert.equal(needsDetailPage("CLOSED", "REOPENED"), true);
  assert.equal(needsDetailPage("OPEN", "IN_PROGRESS"), false);
});

test("dragTargets honours role permissions", () => {
  assert.deepEqual(dragTargets("OPEN", "VENDOR", false).sort(), ["DESIGN_REVIEW", "IN_PROGRESS"]);
  assert.deepEqual(dragTargets("OPEN", "VIEWER", false), []);
  assert.deepEqual(dragTargets("DRAFT", "QA", false), []); // triage happens in the panel / detail
  assert.deepEqual(dragTargets("READY_FOR_VERIFICATION", "QA", false), ["IN_PROGRESS"]);
});

test("columnOf groups terminal statuses and boardLimit clamps", () => {
  assert.equal(columnOf("WONT_FIX").id, "other");
  assert.equal(columnOf("IN_PROGRESS").id, "in_progress");
  assert.equal(boardLimit(undefined), 25);
  assert.equal(boardLimit("50"), 50);
  assert.equal(boardLimit("99999"), 200);
});
