import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { deleteSandbox, pruneStaleSandboxes, resetSandbox, seedSandbox } from "./sandbox-service";
import { sandboxKeyFor } from "./sandbox-key";
import { notifyRerunRequired } from "./notify";

test("seedSandbox: isi dari dataset, reset idempoten, terisolasi per pengguna, tanpa notifikasi", async () => {
  const tag = `sv${Math.random().toString(36).slice(2, 6)}${Date.now().toString().slice(-4)}`;
  const a = await prisma.user.create({ data: { email: `a-${tag}@t.test`, status: "PENDING" } });
  const b = await prisma.user.create({ data: { email: `b-${tag}@t.test`, status: "PENDING" } });
  try {
    const pa = await seedSandbox(a.id);
    const pb = await seedSandbox(b.id);
    assert.equal(pa.key, sandboxKeyFor(a.id));
    assert.notEqual(pa.id, pb.id);
    const count = (pid: string) => Promise.all([prisma.bug.count({ where: { projectId: pid } }), prisma.testCase.count({ where: { projectId: pid } }), prisma.testRun.count({ where: { projectId: pid } }), prisma.businessDoc.count({ where: { projectId: pid } })]);
    const [bugs, cases, runs, docs] = await count(pa.id);
    assert.ok(bugs >= 5 && cases >= 1 && runs >= 3 && docs === 1);

    // Perubahan pengguna A lalu reset: kembali ke data awal; B tidak tersentuh.
    await prisma.bug.deleteMany({ where: { projectId: pa.id, status: "DRAFT" } });
    await prisma.bug.deleteMany({ where: { projectId: pb.id, status: "DRAFT" } });
    await resetSandbox(a.id);
    assert.deepEqual(await count(pa.id), [bugs, cases, runs, docs]);
    assert.equal(await prisma.bug.count({ where: { projectId: pb.id } }), bugs - 1);
    assert.equal(await prisma.project.count({ where: { sandboxOwnerId: a.id } }), 1);
    assert.equal((await prisma.bug.findFirst({ where: { projectId: pa.id, duplicateOfId: { not: null } } }))?.status, "DUPLICATE");

    // Notifikasi dari project Latihan ditahan.
    await prisma.user.update({ where: { id: b.id }, data: { status: "ACTIVE" } });
    await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: pa.id, userId: b.id } }, create: { projectId: pa.id, userId: b.id, role: "ADMIN" }, update: {} });
    const sent = await notifyRerunRequired({ testRunId: "x", testRunTitle: "t", itemTitle: "i", projectId: pa.id, projectKey: pa.key, targetUserIds: [b.id], actor: { id: a.id } });
    assert.equal(sent, 0);
    assert.equal(await prisma.notification.count({ where: { userId: b.id, projectId: pa.id } }), 0);
    // deleteSandbox menghapus project + isinya; pengguna lalu bisa dihapus.
    assert.equal(await deleteSandbox(b.id), true);
    assert.equal(await deleteSandbox(b.id), false);
    assert.equal(await prisma.bug.count({ where: { projectId: pb.id } }), 0);
  } finally {
    await prisma.project.deleteMany({ where: { sandboxOwnerId: { in: [a.id, b.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await fs.rm(path.resolve(process.cwd(), "uploads", sandboxKeyFor(a.id)), { recursive: true, force: true });
    await fs.rm(path.resolve(process.cwd(), "uploads", sandboxKeyFor(b.id)), { recursive: true, force: true });
  }
});

test("pruneStaleSandboxes: ditolak dan basi dihapus, aktif dipertahankan", async () => {
  const tag = `pr${Math.random().toString(36).slice(2, 6)}${Date.now().toString().slice(-4)}`;
  const mk = (status: "ACTIVE" | "REJECTED", n: string) => prisma.user.create({ data: { email: `${n}-${tag}@t.test`, status } });
  const [keep, rejected, idle] = await Promise.all([mk("ACTIVE", "k"), mk("REJECTED", "r"), mk("ACTIVE", "i")]);
  try {
    for (const u of [keep, rejected, idle]) await seedSandbox(u.id);
    await prisma.project.update({ where: { sandboxOwnerId: idle.id }, data: { createdAt: new Date(Date.now() - 100 * 86_400_000) } });
    const n = await pruneStaleSandboxes();
    assert.ok(n >= 2);
    assert.equal(await prisma.project.count({ where: { sandboxOwnerId: keep.id } }), 1);
    assert.equal(await prisma.project.count({ where: { sandboxOwnerId: rejected.id } }), 0);
    assert.equal(await prisma.project.count({ where: { sandboxOwnerId: idle.id } }), 0);
  } finally {
    for (const u of [keep, rejected, idle]) { await deleteSandbox(u.id); await prisma.user.deleteMany({ where: { id: u.id } }); await fs.rm(path.resolve(process.cwd(), "uploads", sandboxKeyFor(u.id)), { recursive: true, force: true }); }
  }
});
