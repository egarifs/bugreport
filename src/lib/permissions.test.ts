import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransitionBug, hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("grants everything to global admin", () => {
    assert.equal(hasPermission(null, "user.review", true), true);
    assert.equal(hasPermission("VIEWER", "bug.create", true), true);
  });

  it("denies access if role is null and not admin", () => {
    assert.equal(hasPermission(null, "project.read", false), false);
  });

  it("enforces role boundaries", () => {
    assert.equal(hasPermission("QA", "bug.review", false), true);
    assert.equal(hasPermission("DEVELOPER", "bug.review", false), false);
    assert.equal(hasPermission("VENDOR", "note.internal.read", false), false);
    assert.equal(hasPermission("DEVELOPER", "note.internal.read", false), true);
    assert.equal(hasPermission("CLIENT", "bug.reopen", false), true);
    assert.equal(hasPermission("VIEWER", "bug.create", false), false);
  });
});

describe("canTransitionBug", () => {
  it("allows QA to approve Draft -> Open", () => {
    const res = canTransitionBug("DRAFT", "OPEN", "QA");
    assert.equal(res.allowed, true);
  });

  it("denies Developer from Draft -> Open", () => {
    const res = canTransitionBug("DRAFT", "OPEN", "DEVELOPER");
    assert.equal(res.allowed, false);
    assert.match(res.reason ?? "", /Missing permission 'bug.review'/);
  });

  it("denies Vendor from Draft -> Open", () => {
    const res = canTransitionBug("DRAFT", "OPEN", "VENDOR");
    assert.equal(res.allowed, false);
  });

  it("allows Developer to move Open -> In Progress", () => {
    const res = canTransitionBug("OPEN", "IN_PROGRESS", "DEVELOPER");
    assert.equal(res.allowed, true);
  });

  it("allows QA to Close from Ready for Verification", () => {
    const res = canTransitionBug("READY_FOR_VERIFICATION", "CLOSED", "QA");
    assert.equal(res.allowed, true);
  });

  it("denies Developer from Closing bug", () => {
    const res = canTransitionBug("READY_FOR_VERIFICATION", "CLOSED", "DEVELOPER");
    assert.equal(res.allowed, false);
    assert.match(res.reason ?? "", /Missing permission 'bug.close'/);
  });

  it("allows Client and QA to Reopen Closed bug", () => {
    assert.equal(canTransitionBug("CLOSED", "REOPENED", "QA").allowed, true);
    assert.equal(canTransitionBug("CLOSED", "REOPENED", "CLIENT").allowed, true);
    assert.equal(canTransitionBug("CLOSED", "REOPENED", "DEVELOPER").allowed, false);
  });

  it("rejects illegal transitions (Draft -> Closed)", () => {
    const res = canTransitionBug("DRAFT", "CLOSED", "ADMIN");
    assert.equal(res.allowed, false);
    assert.match(res.reason ?? "", /not permitted/);
  });
});

describe("role menu (PRD-06)", () => {
  it("blocks AI chat and test cases for client and viewer", () => {
    for (const r of ["CLIENT", "VIEWER"] as const) {
      assert.equal(hasPermission(r, "chat.ask", false), false);
      assert.equal(hasPermission(r, "testcase.read", false), false);
      assert.equal(hasPermission(r, "doc.read", false), true);
    }
    assert.equal(hasPermission("VENDOR", "chat.ask", false), true);
  });
});
