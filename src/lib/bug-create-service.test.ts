import { createTestProject } from "./test-project";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { createBug } from "./bug-create-service";

test("quick bug: title only works, defaults apply, opening needs reviewer and module", async () => {
  const t = Date.now();
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_cb${t}@example.com`, name: n, status: "ACTIVE" } });
  const [qa, dev, viewer] = await Promise.all([mk("qa"), mk("dev"), mk("viewer")]);
  const project = await createTestProject({
    data: {
      key: `CB${String(t).slice(-6)}`, name: "Create",
      members: { create: [{ userId: qa.id, role: "QA" }, { userId: dev.id, role: "DEVELOPER" }, { userId: viewer.id, role: "VIEWER" }] },
      modules: { create: [{ name: "Checkout" }] },
    },
  });
  const mod = await prisma.module.findFirstOrThrow({ where: { projectId: project.id } });
  const Q = { ...qa, role: "QA" as const };
  const D = { ...dev, role: "DEVELOPER" as const };
  const V = { ...viewer, role: "VIEWER" as const };

  const r = await createBug(Q, project.id, { title: "  Tombol bayar mati  " });
  assert.ok("key" in r);
  const bug = await prisma.bug.findFirstOrThrow({ where: { projectId: project.id, key: (r as { key: string }).key } });
  assert.deepEqual([bug.title, bug.severity, bug.status, bug.moduleId, bug.priority], ["Tombol bayar mati", "MEDIUM", "DRAFT", null, "NORMAL"]);

  // validation
  assert.equal((await createBug(Q, project.id, { title: " " })).error, "Isi judul bug.");
  assert.equal((await createBug(Q, project.id, { title: "x", severity: "NGAWUR" })).error, "Severity tidak valid.");
  assert.match((await createBug(V, project.id, { title: "x" })).error ?? "", /tidak bisa melaporkan/);

  // priority is a reviewer setting
  const dv = await createBug(D, project.id, { title: "dev bug", priority: "URGENT", severity: "HIGH" }) as { key: string };
  assert.equal((await prisma.bug.findFirstOrThrow({ where: { key: dv.key } })).priority, "NORMAL");
  const qv = await createBug(Q, project.id, { title: "qa bug", priority: "URGENT", tags: "UI, login" }) as { key: string };
  const qb = await prisma.bug.findFirstOrThrow({ where: { key: qv.key }, include: { tags: true } });
  assert.equal(qb.priority, "URGENT");
  assert.deepEqual(qb.tags.map((x) => x.name).sort(), ["login", "ui"]);

  // opening straight away: reviewer + module only
  assert.match((await createBug(Q, project.id, { title: "open", asDraft: false })).error ?? "", /Pilih modul/);
  assert.match((await createBug(D, project.id, { title: "open", asDraft: false, moduleId: mod.id })).error ?? "", /Hanya reviewer/);
  const open = await createBug(Q, project.id, { title: "open ok", asDraft: false, moduleId: mod.id }) as { key: string };
  assert.equal((await prisma.bug.findFirstOrThrow({ where: { key: open.key } })).status, "OPEN");

  // numbers follow bugSeq without gaps
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).bugSeq, 4);
});
