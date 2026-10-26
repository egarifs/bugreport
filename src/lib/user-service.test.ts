import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { upsertGoogleUser, isConfiguredAdmin, recordAuditLog } from "./user-service";

describe("user-service integration", () => {
  before(async () => {
    process.env.ADMIN_EMAILS = "admin@example.com,owner@example.com";
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { in: ["admin@example.com", "regular@example.com", "newuser@example.com"] } },
    });
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("identifies configured admin emails", () => {
    assert.equal(isConfiguredAdmin("admin@example.com"), true);
    assert.equal(isConfiguredAdmin("ADMIN@EXAMPLE.COM"), true);
    assert.equal(isConfiguredAdmin("regular@example.com"), false);
  });

  it("creates configured admin user directly as ACTIVE and isAdmin=true", async () => {
    const user = await upsertGoogleUser({
      email: "admin@example.com",
      name: "Admin User",
    });
    assert.equal(user.status, "ACTIVE");
    assert.equal(user.isAdmin, true);
  });

  it("creates regular user as PENDING and isAdmin=false", async () => {
    const user = await upsertGoogleUser({
      email: "regular@example.com",
      name: "Regular QA",
    });
    assert.equal(user.status, "PENDING");
    assert.equal(user.isAdmin, false);
  });

  it("records audit logs accurately", async () => {
    const log = await recordAuditLog({
      actorEmail: "admin@example.com",
      action: "user.approve",
      entityType: "user",
      entityId: "target-user-123",
      changes: {
        before: { status: "PENDING" },
        after: { status: "ACTIVE" },
      },
    });
    assert.equal(log.action, "user.approve");
    assert.equal(log.actorEmail, "admin@example.com");

    const fetched = await prisma.auditLog.findUnique({ where: { id: log.id } });
    assert.ok(fetched);
    assert.equal(fetched.action, "user.approve");
  });
});
