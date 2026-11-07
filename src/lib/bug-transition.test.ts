import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { guardBugTransition } from "./bug-transition";

test("AC-PERM-01: VENDOR close is denied, status unchanged, attempt audited", async () => {
  const t = Date.now();
  const mk = (n: string, isAdmin = false) =>
    prisma.user.create({ data: { email: `${n}_pm${t}@example.com`, name: n, status: "ACTIVE", isAdmin } });
  const [vendor, qa] = await Promise.all([mk("vendor"), mk("qa")]);
  const project = await prisma.project.create({
    data: {
      key: `PM${String(t).slice(-6)}`, name: "Perm",
      members: { create: [{ userId: vendor.id, role: "VENDOR" }, { userId: qa.id, role: "QA" }] },
    },
  });
  const bug = await prisma.bug.create({
    data: { projectId: project.id, number: 1, key: `${project.key}-1`, title: "x", severity: "HIGH", reporterId: qa.id, status: "READY_FOR_VERIFICATION" },
  });

  const denied = await guardBugTransition(bug, project.id, "CLOSED", { ...vendor, role: "VENDOR" });
  assert.equal(denied.allowed, false);
  assert.equal((await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status, "READY_FOR_VERIFICATION");
  const logs = await prisma.auditLog.findMany({ where: { entityId: bug.id, action: "bug.status_change_denied" } });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorId, vendor.id);

  const ok = await guardBugTransition(bug, project.id, "CLOSED", { ...qa, role: "QA" });
  assert.equal(ok.allowed, true);
  assert.equal(await prisma.auditLog.count({ where: { entityId: bug.id, action: "bug.status_change_denied" } }), 1);
});
