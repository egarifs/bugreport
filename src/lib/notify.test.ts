import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { notifyBug, notifyAdminsPendingUser } from "./notify";

test("notifications: recipients, internal-note privacy, self-skip", async () => {
  const t = Date.now();
  const mk = (n: string, isAdmin = false) => prisma.user.create({ data: { email: `${n}_n${t}@example.com`, name: n, status: "ACTIVE", isAdmin } });
  const [qa, vendor, dev, outsider] = await Promise.all([mk("qa"), mk("vendor"), mk("dev"), mk("outsider")]);
  const project = await prisma.project.create({
    data: {
      key: `N${String(t).slice(-6)}`, name: "Notify",
      members: { create: [{ userId: qa.id, role: "QA" }, { userId: vendor.id, role: "VENDOR" }, { userId: dev.id, role: "DEVELOPER" }] },
    },
  });
  const bug = await prisma.bug.create({
    data: { projectId: project.id, number: 1, key: `${project.key}-1`, title: "Login gagal", severity: "HIGH", reporterId: qa.id, assigneeId: vendor.id, status: "OPEN" },
  });
  const inbox = (u: { id: string }) => prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });

  assert.equal(await notifyBug(bug.id, qa, { kind: "assign" }), 1);
  assert.match((await inbox(vendor))[0].title, /qa menugaskan .*-1 ke Anda/);
  assert.equal((await inbox(vendor))[0].href, `/projects/${project.key}/bugs/1`);

  // vendor comments publicly -> only reporter (qa); actor skipped
  assert.equal(await notifyBug(bug.id, vendor, { kind: "comment", commentType: "PUBLIC", excerpt: "sudah fix" }), 1);
  assert.equal((await inbox(qa))[0].body, "sudah fix");

  // internal note by dev -> qa yes, vendor never
  const before = (await inbox(vendor)).length;
  assert.equal(await notifyBug(bug.id, dev, { kind: "comment", commentType: "INTERNAL", excerpt: "rahasia" }), 1);
  assert.equal((await inbox(vendor)).length, before);

  assert.equal(await notifyBug(bug.id, vendor, { kind: "status", from: "OPEN", to: "READY_FOR_VERIFICATION" }), 1);
  assert.match((await inbox(qa)).at(-1)!.title, /Open → Perlu verifikasi/);

  // draft -> reviewers only (qa), never vendor/dev/outsider
  assert.equal(await notifyBug(bug.id, { id: null, name: "Agent" }, { kind: "draft", source: "mcp" }), 1);
  assert.equal((await inbox(outsider)).length, 0);
  assert.equal((await inbox(dev)).length, 0);

  const admin = await mk("admin", true);
  assert.ok((await notifyAdminsPendingUser({ email: "new@example.com" })) >= 1);
  assert.equal((await inbox(admin))[0].href, "/admin/users");

  // never throws
  assert.equal(await notifyBug("missing-id", qa, { kind: "assign" }), 0);
});
