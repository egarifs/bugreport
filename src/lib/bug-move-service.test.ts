import { createTestProject } from "./test-project";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { moveBugStatus } from "./bug-move-service";

test("board move: allowed drag audited, forbidden or detail-only moves leave status untouched", async () => {
  const t = Date.now();
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_bm${t}@example.com`, name: n, status: "ACTIVE" } });
  const [vendor, qa] = await Promise.all([mk("vendor"), mk("qa")]);
  const project = await createTestProject({
    data: {
      key: `BM${String(t).slice(-6)}`, name: "Board",
      members: { create: [{ userId: vendor.id, role: "VENDOR" }, { userId: qa.id, role: "QA" }] },
    },
  });
  const bug = await prisma.bug.create({
    data: { projectId: project.id, number: 1, key: `${project.key}-1`, title: "x", severity: "HIGH", reporterId: qa.id, status: "OPEN" },
  });
  const status = async () => (await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status;
  const v = { ...vendor, role: "VENDOR" as const };
  const q = { ...qa, role: "QA" as const };

  assert.deepEqual(await moveBugStatus(v, project.id, bug.id, "IN_PROGRESS"), { ok: "Status diubah." });
  assert.equal(await status(), "IN_PROGRESS");
  const log = await prisma.auditLog.findMany({ where: { entityId: bug.id, action: "bug.status_change" } });
  assert.equal(log.length, 1);

  // needs verification build / reason: refused even for QA, only the detail page may do it
  await prisma.bug.update({ where: { id: bug.id }, data: { status: "READY_FOR_VERIFICATION" } });
  assert.match((await moveBugStatus(q, project.id, bug.id, "CLOSED")).error ?? "", /detail/i);
  assert.ok((await moveBugStatus(v, project.id, bug.id, "IN_PROGRESS")).ok);
  assert.ok((await moveBugStatus(v, project.id, bug.id, "READY_FOR_VERIFICATION")).ok);
  // bug of another project cannot be moved
  const other = await createTestProject({ data: { key: `BO${String(t).slice(-6)}`, name: "Other" } });
  assert.equal((await moveBugStatus(q, other.id, bug.id, "IN_PROGRESS")).error, "Bug tidak ditemukan.");
  assert.equal(await status(), "READY_FOR_VERIFICATION");
});

test("board move: a stale expected status is refused and the newer status survives", async () => {
  const t = Date.now();
  const qa = await prisma.user.create({ data: { email: `qa_bms${t}@example.com`, name: "qa", status: "ACTIVE" } });
  const project = await createTestProject({ data: { key: `BS${String(t).slice(-6)}`, name: "Stale", members: { create: [{ userId: qa.id, role: "QA" }] } } });
  const bug = await prisma.bug.create({ data: { projectId: project.id, number: 1, key: `${project.key}-1`, title: "x", severity: "HIGH", reporterId: qa.id, status: "IN_PROGRESS" } });
  const q = { ...qa, role: "QA" as const };
  // another browser already moved it from OPEN to IN_PROGRESS; this one still shows OPEN
  assert.match((await moveBugStatus(q, project.id, bug.id, "DESIGN_REVIEW", "OPEN")).error ?? "", /sudah berubah/);
  assert.equal((await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status, "IN_PROGRESS");
  assert.ok((await moveBugStatus(q, project.id, bug.id, "DESIGN_REVIEW", "IN_PROGRESS")).ok);
});
