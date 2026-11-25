import { createTestProject } from "./test-project";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { addBugTag, normalizeTag, removeBugTag } from "./bug-tag-service";

test("normalizeTag lowercases, hyphenates and strips #", () => {
  assert.equal(normalizeTag("  #Login Page "), "login-page");
});

test("tags: shared per project, role-gated, orphans removed, project-scoped", async () => {
  const t = Date.now();
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_tg${t}@example.com`, name: n, status: "ACTIVE" } });
  const [dev, viewer] = await Promise.all([mk("dev"), mk("viewer")]);
  const project = await createTestProject({
    data: { key: `TG${String(t).slice(-6)}`, name: "Tags", members: { create: [{ userId: dev.id, role: "DEVELOPER" }, { userId: viewer.id, role: "VIEWER" }] } },
  });
  const other = await createTestProject({ data: { key: `TO${String(t).slice(-6)}`, name: "Other" } });
  const mkBug = (n: number) => prisma.bug.create({ data: { projectId: project.id, number: n, key: `${project.key}-${n}`, title: "x", severity: "LOW", reporterId: dev.id } });
  const [b1, b2] = await Promise.all([mkBug(1), mkBug(2)]);
  const D = { ...dev, role: "DEVELOPER" as const };
  const V = { ...viewer, role: "VIEWER" as const };

  assert.match((await addBugTag(V, project.id, b1.id, "ui")).error ?? "", /tidak bisa/);
  assert.ok((await addBugTag(D, project.id, b1.id, "#UI")).ok);
  assert.ok((await addBugTag(D, project.id, b2.id, "ui")).ok); // same tag row reused
  assert.equal(await prisma.bugTag.count({ where: { projectId: project.id } }), 1);
  assert.match((await addBugTag(D, project.id, b1.id, "x".repeat(31))).error ?? "", /maksimal/);
  assert.equal((await addBugTag(D, other.id, b1.id, "ui")).error, "Bug tidak ditemukan.");

  const tag = await prisma.bugTag.findFirstOrThrow({ where: { projectId: project.id } });
  assert.ok((await removeBugTag(D, project.id, b1.id, tag.id)).ok);
  assert.equal(await prisma.bugTag.count({ where: { projectId: project.id } }), 1); // b2 still uses it
  assert.ok((await removeBugTag(D, project.id, b2.id, tag.id)).ok);
  assert.equal(await prisma.bugTag.count({ where: { projectId: project.id } }), 0); // orphan dropped
});
