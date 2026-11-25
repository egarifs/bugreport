import { createTestProject } from "./test-project";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { BULK_MAX, bulkUpdateBugs } from "./bug-bulk-service";

test("bulk update: per-bug rules apply, failures are reported, other projects untouched", async () => {
  const t = Date.now();
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_bk${t}@example.com`, name: n, status: "ACTIVE" } });
  const [dev, viewer, outsider] = await Promise.all([mk("dev"), mk("viewer"), mk("outsider")]);
  const project = await createTestProject({
    data: { key: `BK${String(t).slice(-6)}`, name: "Bulk", members: { create: [{ userId: dev.id, role: "DEVELOPER" }, { userId: viewer.id, role: "VIEWER" }] } },
  });
  const other = await createTestProject({ data: { key: `BL${String(t).slice(-6)}`, name: "Other" } });
  const mkBug = (projectId: string, n: number, status: "OPEN" | "DRAFT" | "CLOSED") =>
    prisma.bug.create({ data: { projectId, number: n, key: `${projectId.slice(0, 4)}-${n}`, title: `b${n}`, severity: "LOW", status, reporterId: dev.id } });
  const [a, b, d] = await Promise.all([mkBug(project.id, 1, "OPEN"), mkBug(project.id, 2, "OPEN"), mkBug(project.id, 3, "DRAFT")]);
  const foreign = await mkBug(other.id, 1, "OPEN");
  const D = { ...dev, role: "DEVELOPER" as const };
  const V = { ...viewer, role: "VIEWER" as const };
  const status = async (id: string) => (await prisma.bug.findUniqueOrThrow({ where: { id } })).status;

  // status: OPEN -> IN_PROGRESS works, DRAFT -> IN_PROGRESS is refused, summary says so
  const res = await bulkUpdateBugs(D, project.id, [a.id, b.id, d.id], { kind: "status", target: "IN_PROGRESS" });
  assert.match(res.ok ?? "", /^2 bug diubah\. Gagal 1/);
  assert.equal(await status(a.id), "IN_PROGRESS");
  assert.equal(await status(d.id), "DRAFT");

  // ids from another project are never touched
  assert.match((await bulkUpdateBugs(D, project.id, [foreign.id], { kind: "status", target: "IN_PROGRESS" })).error ?? "", /Tidak ada bug/);
  assert.equal(await status(foreign.id), "OPEN");

  // assign: only members, only with bug.update
  assert.match((await bulkUpdateBugs(D, project.id, [a.id], { kind: "assign", userId: outsider.id })).error ?? "", /anggota/);
  assert.match((await bulkUpdateBugs(V, project.id, [a.id], { kind: "assign", userId: dev.id })).error ?? "", /Tidak ada bug/);
  assert.ok((await bulkUpdateBugs(D, project.id, [a.id, b.id], { kind: "assign", userId: dev.id })).ok);
  assert.equal((await prisma.bug.findUniqueOrThrow({ where: { id: b.id } })).assigneeId, dev.id);
  assert.ok((await bulkUpdateBugs(D, project.id, [a.id, b.id], { kind: "assign", userId: null })).ok);
  assert.equal((await prisma.bug.findUniqueOrThrow({ where: { id: b.id } })).assigneeId, null);

  // tag
  assert.ok((await bulkUpdateBugs(D, project.id, [a.id, b.id], { kind: "tag", name: "Regresi" })).ok);
  assert.equal(await prisma.bug.count({ where: { projectId: project.id, tags: { some: { name: "regresi" } } } }), 2);

  // limits
  assert.match((await bulkUpdateBugs(D, project.id, [], { kind: "tag", name: "x" })).error ?? "", /minimal satu/);
  assert.match((await bulkUpdateBugs(D, project.id, Array.from({ length: BULK_MAX + 1 }, (_, i) => `id${i}`), { kind: "tag", name: "x" })).error ?? "", /Maksimal/);
});
