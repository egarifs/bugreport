import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { saveTestCaseCore, deleteTestCaseCore } from "./testcase-service";

test("Single test case core service", async (t) => {
  const project = await prisma.project.findFirstOrThrow();

  // Test 1: Validation failure on missing steps/expectedResult
  await t.test("rejects missing title or steps", async () => {
    const res = await saveTestCaseCore(project.id, project.key, {
      title: "",
      steps: "",
      expectedResult: "",
    });
    assert.match(res.error || "", /Judul test case wajib diisi/);
  });

  // Test 2: Create valid single test case with auto-sequence code
  let createdId = "";
  let createdCode = "";
  await t.test("creates single test case with auto-code", async () => {
    const res = await saveTestCaseCore(project.id, project.key, {
      title: "Verifikasi modal CRUD test case",
      priority: "HIGH",
      steps: "1. Buka modul test case\n2. Klik tombol tambah\n3. Simpan",
      expectedResult: "Data tersimpan dan modal tertutup",
    });
    assert.match(res.ok || "", /berhasil disimpan/);
    assert.ok(res.id);
    assert.ok(res.code);
    assert.ok(res.code.startsWith(`TC-${project.key}`));
    createdId = res.id;
    createdCode = res.code;

    const tc = await prisma.testCase.findUnique({ where: { id: createdId } });
    assert.equal(tc?.priority, "HIGH");
    assert.equal(tc?.title, "Verifikasi modal CRUD test case");
  });

  // Test 3: Update existing test case
  await t.test("updates single test case", async () => {
    assert.ok(createdId);
    const res = await saveTestCaseCore(project.id, project.key, {
      id: createdId,
      code: createdCode,
      title: "Verifikasi modal CRUD test case (Updated)",
      priority: "CRITICAL",
      steps: "1. Edit baris skenario",
      expectedResult: "Hasil pengujian terupdate",
    });
    assert.match(res.ok || "", /berhasil diperbarui/);

    const tc = await prisma.testCase.findUnique({ where: { id: createdId } });
    assert.equal(tc?.title, "Verifikasi modal CRUD test case (Updated)");
    assert.equal(tc?.priority, "CRITICAL");
  });

  // Test 4: Delete single test case
  await t.test("deletes single test case if not in test run", async () => {
    assert.ok(createdId);
    const res = await deleteTestCaseCore(project.id, createdId);
    assert.match(res.ok || "", /berhasil dihapus/);

    const check = await prisma.testCase.findUnique({ where: { id: createdId } });
    assert.equal(check, null);
  });
});
