import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { startOfTodayWib, triageBug } from "./triage-service";

test("startOfTodayWib", () => {
  assert.equal(startOfTodayWib(new Date("2026-11-03T18:00:00Z")).toISOString(), "2026-11-03T17:00:00.000Z");
  assert.equal(startOfTodayWib(new Date("2026-11-03T10:00:00Z")).toISOString(), "2026-11-02T17:00:00.000Z");
});

test("triageBug: edit, accept gate, reject, vendor denied + audited", async () => {
  const t = Date.now();
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_tr${t}@example.com`, name: n, status: "ACTIVE" } });
  const [qa, vendor] = await Promise.all([mk("qa"), mk("vendor")]);
  const project = await prisma.project.create({
    data: { key: `TR${String(t).slice(-6)}`, name: "Triage", members: { create: [{ userId: qa.id, role: "QA" }, { userId: vendor.id, role: "VENDOR" }] } },
  });
  const mod = await prisma.module.create({ data: { projectId: project.id, name: "Laporan" } });
  const draft = (n: number, extra = {}) =>
    prisma.bug.create({ data: { projectId: project.id, number: n, key: `${project.key}-${n}`, title: "x", severity: "LOW", reporterId: qa.id, status: "DRAFT", ...extra } });
  const asQa = { id: qa.id, email: qa.email, isAdmin: false, role: "QA" as const };
  const asVendor = { id: vendor.id, email: vendor.email, isAdmin: false, role: "VENDOR" as const };

  const b1 = await draft(1);
  const r1 = await triageBug(asQa, project.id, b1.id, { severity: "HIGH", priority: "URGENT", moduleId: mod.id, assigneeId: vendor.id });
  assert.ok("ok" in r1);
  const after = await prisma.bug.findUniqueOrThrow({ where: { id: b1.id } });
  assert.deepEqual([after.severity, after.priority, after.moduleId, after.assigneeId, after.status], ["HIGH", "URGENT", mod.id, vendor.id, "DRAFT"]);

  // accept blocked without build/version
  assert.match((await triageBug(asQa, project.id, b1.id, { accept: true })).error!, /versi\/build/);
  await prisma.bug.update({ where: { id: b1.id }, data: { appVersion: "1.0" } });
  assert.ok("ok" in (await triageBug(asQa, project.id, b1.id, { accept: true })));
  assert.equal((await prisma.bug.findUniqueOrThrow({ where: { id: b1.id } })).status, "OPEN");
  assert.match((await triageBug(asQa, project.id, b1.id, { severity: "LOW" })).error!, /draft/);

  // foreign module and non-member assignee are ignored
  const b2 = await draft(2);
  await triageBug(asQa, project.id, b2.id, { moduleId: "nope", assigneeId: "nope" });
  const a2 = await prisma.bug.findUniqueOrThrow({ where: { id: b2.id } });
  assert.deepEqual([a2.moduleId, a2.assigneeId], [null, null]);

  // reject
  assert.ok("ok" in (await triageBug(asQa, project.id, b2.id, { reject: true })));
  assert.equal((await prisma.bug.findUniqueOrThrow({ where: { id: b2.id } })).status, "INVALID");

  // vendor cannot reject; attempt audited
  const b3 = await draft(3);
  assert.ok((await triageBug(asVendor, project.id, b3.id, { reject: true })).error);
  assert.equal((await prisma.bug.findUniqueOrThrow({ where: { id: b3.id } })).status, "DRAFT");
  assert.equal(await prisma.auditLog.count({ where: { entityId: b3.id, action: "bug.status_change_denied" } }), 1);
});
