import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { buildLabel, dueLabel, verifyBug } from "./verify-service";

test("buildLabel / dueLabel (AC-BUG-07)", () => {
  assert.equal(buildLabel("1.8.0", "b214"), "1.8.0 · b214");
  assert.equal(buildLabel(null, "b214"), "b214");
  assert.equal(buildLabel(), "");
  const now = new Date("2026-11-03T05:00:00Z");
  const d = new Date("2026-11-01T05:00:00Z");
  assert.deepEqual(dueLabel(d, "OPEN", now), { text: "1 Nov · lewat", overdue: true });
  assert.equal(dueLabel(d, "CLOSED", now).overdue, false);
  assert.equal(dueLabel(new Date("2026-11-05T05:00:00Z"), "OPEN", now).text, "5 Nov");
});

test("verifyBug: pass closes + records build; fail needs reason, reopens; vendor denied", async () => {
  const t = Date.now();
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_vf${t}@example.com`, name: n, status: "ACTIVE" } });
  const [qa, vendor] = await Promise.all([mk("qa"), mk("vendor")]);
  const project = await prisma.project.create({
    data: { key: `VF${String(t).slice(-6)}`, name: "Verify", members: { create: [{ userId: qa.id, role: "QA" }, { userId: vendor.id, role: "VENDOR" }] } },
  });
  const ready = (n: number) =>
    prisma.bug.create({ data: { projectId: project.id, number: n, key: `${project.key}-${n}`, title: "x", severity: "HIGH", reporterId: qa.id, status: "READY_FOR_VERIFICATION", fixedInVersion: "1.8.0", fixedInBuild: "b214" } });
  const asQa = { id: qa.id, email: qa.email, isAdmin: false, role: "QA" as const };
  const asVendor = { id: vendor.id, email: vendor.email, isAdmin: false, role: "VENDOR" as const };
  const get = (id: string) => prisma.bug.findUniqueOrThrow({ where: { id } });

  const a = await ready(1);
  assert.ok((await verifyBug(asVendor, project.id, a.id, "pass")).error);
  assert.equal((await get(a.id)).status, "READY_FOR_VERIFICATION");
  assert.equal(await prisma.auditLog.count({ where: { entityId: a.id, action: "bug.status_change_denied" } }), 1);

  assert.match((await verifyBug(asQa, project.id, a.id, "fail", "  ")).error!, /Alasan wajib/);
  assert.equal((await get(a.id)).status, "READY_FOR_VERIFICATION");

  assert.ok("ok" in (await verifyBug(asQa, project.id, a.id, "pass")));
  const closed = await get(a.id);
  assert.deepEqual([closed.status, closed.verifiedInBuild, !!closed.verifiedAt], ["CLOSED", "1.8.0 · b214", true]);
  assert.ok((await verifyBug(asQa, project.id, a.id, "pass")).error); // not ready anymore

  const b = await ready(2);
  assert.ok("ok" in (await verifyBug(asQa, project.id, b.id, "fail", "Masih error di Safari")));
  const re = await get(b.id);
  assert.deepEqual([re.status, re.reopenCount, re.reopenReason, re.verifiedAt], ["REOPENED", 1, "Masih error di Safari", null]);
});
