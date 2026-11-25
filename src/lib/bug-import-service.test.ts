import { createTestProject } from "./test-project";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { importBugs, previewBugImport } from "./bug-import-service";

const MD = "| Judul | Modul | Severity | Langkah | Aktual | Ekspektasi |\n| --- | --- | --- | --- | --- | --- |\n| Checkout crash | Checkout | High | Klik bayar | Err 500 | Sukses |\n| Logo buram | - | Low | Buka beranda | Buram | Tajam |\n";

test("import: preview flags duplicates, import numbers via bugSeq and stays in step with the report form", async () => {
  const t = Date.now();
  const user = await prisma.user.create({ data: { email: `imp_${t}@example.com`, name: "imp", status: "ACTIVE" } });
  const project = await createTestProject({ data: { key: `IM${String(t).slice(-6)}`, name: "Import", members: { create: [{ userId: user.id, role: "QA" }] } } });
  await prisma.bug.create({ data: { projectId: project.id, number: 1, key: `${project.key}-1`, title: "checkout crash", severity: "LOW", reporterId: user.id } });
  await prisma.project.update({ where: { id: project.id }, data: { bugSeq: 1 } });

  assert.deepEqual(await previewBugImport(project.id, "  "), { error: "Pilih file Markdown (.md)." });
  assert.match((await previewBugImport(project.id, "bukan tabel") as { error: string }).error, /Tidak ada bug yang terbaca/);
  const preview = await previewBugImport(project.id, MD);
  assert.ok("rows" in preview);
  if ("rows" in preview) {
    assert.deepEqual(preview.rows.map((r) => r.status), ["Mirip", "Siap"]);
    assert.equal(preview.rows[0].note, `Mirip ${project.key}-1`);
  }
  assert.equal(await prisma.bug.count({ where: { projectId: project.id } }), 1); // preview wrote nothing

  const res = await importBugs(user.id, project.id, project.key, MD);
  assert.match(res.ok ?? "", /2 bug/);
  const keys = (await prisma.bug.findMany({ where: { projectId: project.id }, orderBy: { number: "asc" } })).map((b) => [b.key, b.status]); // all Draft: import never opens a bug
  assert.deepEqual(keys, [[`${project.key}-1`, "DRAFT"], [`${project.key}-2`, "DRAFT"], [`${project.key}-3`, "DRAFT"]]);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).bugSeq, 3);
});
