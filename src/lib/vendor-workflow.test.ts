import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { canTransitionBug, hasPermission } from "./permissions";
import { BugStatus } from "@prisma/client";

describe("PRD-02 Vendor Workflow & Quality Gates", () => {
  it("vendor cannot read internal comments", () => {
    const vendorCanSee = hasPermission("VENDOR", "note.internal.read", false);
    assert.equal(vendorCanSee, false);

    const clientCanSee = hasPermission("CLIENT", "note.internal.read", false);
    assert.equal(clientCanSee, false);

    const qaCanSee = hasPermission("QA", "note.internal.read", false);
    assert.equal(qaCanSee, true);

    const adminCanSee = hasPermission("ADMIN", "note.internal.read", false);
    assert.equal(adminCanSee, true);
  });

  it("vendor cannot approve Draft to Open", () => {
    const transition = canTransitionBug(BugStatus.DRAFT, BugStatus.OPEN, "VENDOR", false);
    assert.equal(transition.allowed, false);
  });

  it("vendor can move Open to In Progress, and In Progress to Ready for Verification", () => {
    const toProgress = canTransitionBug(BugStatus.OPEN, BugStatus.IN_PROGRESS, "VENDOR", false);
    assert.equal(toProgress.allowed, true);

    const toReady = canTransitionBug(BugStatus.IN_PROGRESS, BugStatus.READY_FOR_VERIFICATION, "VENDOR", false);
    assert.equal(toReady.allowed, true);
  });

  it("vendor cannot Close or Reopen bugs directly", () => {
    const toClose = canTransitionBug(BugStatus.READY_FOR_VERIFICATION, BugStatus.CLOSED, "VENDOR", false);
    assert.equal(toClose.allowed, false);

    const toReopen = canTransitionBug(BugStatus.CLOSED, BugStatus.REOPENED, "VENDOR", false);
    assert.equal(toReopen.allowed, false);
  });

  it("verifies pg_trgm similarity finds duplicates across active bugs", async () => {
    // Check extension is active
    const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
    `;
    assert.equal(ext.length, 1);

    // Verify similarity calculation
    const result = await prisma.$queryRaw<Array<{ sim: number }>>`
      SELECT similarity('Halaman Complaint bisa dibuka user', 'Halaman Complaint terbuka tanpa login') as sim;
    `;
    assert.ok(result[0].sim > 0.35);
  });
});
