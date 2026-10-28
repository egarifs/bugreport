import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { checkProjectPermission } from "./authz";

test("server action authz re-check", async (t) => {
  const tag = `authz${Date.now()}`;
  const project = await prisma.project.create({ data: { key: tag.toUpperCase().slice(0, 10), name: tag } });
  const other = await prisma.project.create({ data: { key: `O${tag}`.toUpperCase().slice(0, 10), name: `o${tag}` } });
  const vendor = await prisma.user.create({ data: { email: `v-${tag}@t.test`, status: "ACTIVE" } });
  const suspended = await prisma.user.create({ data: { email: `s-${tag}@t.test`, status: "SUSPENDED" } });
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: vendor.id, role: "VENDOR" },
      { projectId: project.id, userId: suspended.id, role: "QA" },
    ],
  });
  try {
    await t.test("no session rejected", () =>
      assert.rejects(checkProjectPermission(undefined, project.id, "project.read"), /Unauthorized/));
    await t.test("vendor allowed testrun.execute", async () =>
      assert.equal((await checkProjectPermission(vendor.id, project.id, "testrun.execute")).role, "VENDOR"));
    await t.test("vendor denied doc.manage / testcase.manage / project.manage", async () => {
      for (const p of ["doc.manage", "testcase.manage", "project.manage"] as const)
        await assert.rejects(checkProjectPermission(vendor.id, project.id, p), /Forbidden/);
    });
    await t.test("cross-project denied", () =>
      assert.rejects(checkProjectPermission(vendor.id, other.id, "project.read"), /Forbidden/));
    await t.test("suspended user denied even with QA role", () =>
      assert.rejects(checkProjectPermission(suspended.id, project.id, "project.read"), /Unauthorized/));
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: [project.id, other.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [vendor.id, suspended.id] } } });
  }
});
