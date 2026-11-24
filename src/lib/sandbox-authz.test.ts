import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { checkProjectPermission } from "./authz";
import { pendingMayAccess, pendingPathAllowed } from "./sandbox";
import { sandboxKeyFor } from "./sandbox-key";

test("sandbox helpers", () => {
  assert.match(sandboxKeyFor("u1"), /^LAT[0-9A-F]{6}$/);
  assert.equal(sandboxKeyFor("u1"), sandboxKeyFor("u1"));
  assert.notEqual(sandboxKeyFor("u1"), sandboxKeyFor("u2"));
  assert.equal(pendingPathAllowed("/projects/LAT1234/bugs"), true);
  assert.equal(pendingPathAllowed("/projects/new"), false);
  assert.equal(pendingPathAllowed("/onboarding"), true);
  assert.equal(pendingPathAllowed("/api/projects/CRM/export"), false);
  assert.equal(pendingPathAllowed("/api/projects/LAT1/attachments/x"), true);
  assert.equal(pendingPathAllowed("/projects"), false);
  assert.equal(pendingPathAllowed("/admin/users"), false);
  assert.equal(pendingMayAccess({ id: "a", status: "ACTIVE" }, { isSandbox: true, sandboxOwnerId: "a" }), false);
});

test("PENDING hanya boleh di project Latihan miliknya", async (t) => {
  const tag = `sb${Math.random().toString(36).slice(2, 6)}${Date.now().toString().slice(-4)}`;
  const mk = (status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED", n: string) => prisma.user.create({ data: { email: `${n}-${tag}@t.test`, status } });
  const [pend, pend2, active, rejected] = await Promise.all([mk("PENDING", "p"), mk("PENDING", "q"), mk("ACTIVE", "a"), mk("REJECTED", "r")]);
  const real = await prisma.project.create({ data: { key: `R${tag}`.toUpperCase().slice(0, 10), name: `r${tag}` } });
  const box = await prisma.project.create({ data: { key: `S${tag}`.toUpperCase().slice(0, 10), name: `s${tag}`, isSandbox: true, sandboxOwnerId: pend.id } });
  const box2 = await prisma.project.create({ data: { key: `T${tag}`.toUpperCase().slice(0, 10), name: `t${tag}`, isSandbox: true, sandboxOwnerId: pend2.id } });
  await prisma.projectMember.createMany({
    data: [
      { projectId: box.id, userId: pend.id, role: "ADMIN" },
      { projectId: box2.id, userId: pend2.id, role: "ADMIN" },
      { projectId: real.id, userId: pend.id, role: "QA" }, // keanggotaan di project asli tidak membuka akses selama PENDING
      { projectId: box.id, userId: active.id, role: "QA" },
      { projectId: box.id, userId: rejected.id, role: "ADMIN" },
    ],
  });
  try {
    await t.test("PENDING diizinkan di sandbox miliknya", async () => assert.equal((await checkProjectPermission(pend.id, box.id, "bug.create")).role, "ADMIN"));
    await t.test("PENDING ditolak di project asli", () => assert.rejects(checkProjectPermission(pend.id, real.id, "project.read"), /Unauthorized/));
    await t.test("PENDING ditolak di sandbox orang lain", () => assert.rejects(checkProjectPermission(pend.id, box2.id, "project.read"), /Unauthorized/));
    await t.test("REJECTED pemilik sandbox ditolak", async () => {
      await prisma.project.update({ where: { id: box.id }, data: { sandboxOwnerId: rejected.id } });
      await assert.rejects(checkProjectPermission(rejected.id, box.id, "project.read"), /Unauthorized/);
      await prisma.project.update({ where: { id: box.id }, data: { sandboxOwnerId: pend.id } });
    });
    await t.test("ACTIVE bukan anggota ditolak di sandbox orang lain", () => assert.rejects(checkProjectPermission(active.id, box2.id, "project.read"), /Forbidden/));
    await t.test("setelah disetujui, tetap bisa di sandbox sendiri", async () => {
      await prisma.user.update({ where: { id: pend.id }, data: { status: "ACTIVE" } });
      assert.equal((await checkProjectPermission(pend.id, box.id, "project.read")).role, "ADMIN");
    });
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: [real.id, box.id, box2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pend.id, pend2.id, active.id, rejected.id] } } });
  }
});
