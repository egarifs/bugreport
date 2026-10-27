import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseTestCaseWorkbook } from "./testcase-importer";
import { prisma } from "./db";
import { createBugDraftFromTestRunItem } from "./testrun-service";
import { hasPermission } from "./permissions";

test("PRD-02B Business Docs & Test Cases", async (t) => {
  await t.test("Vendor cannot manage test cases or docs but can execute test runs", () => {
    assert.equal(hasPermission("VENDOR", "testcase.manage"), false);
    assert.equal(hasPermission("VENDOR", "doc.manage"), false);
    assert.equal(hasPermission("VENDOR", "testcase.read"), true);
    assert.equal(hasPermission("VENDOR", "doc.read"), true);
    assert.equal(hasPermission("VENDOR", "testrun.execute"), true);
  });

  await t.test("parseTestCaseWorkbook parses CRM template format accurately", () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      {
        "ID": "TC-PKT-001",
        "Area": "Paket RS",
        "Judul Testcase": "Verifikasi validasi input kuota paket",
        "Prioritas": "High",
        "Tipe": "Functional",
        "Role": "RS_Finance",
        "Prasyarat": "User terautentikasi dan berada di menu Paket",
        "Langkah": "1) Klik tombol Tambah Paket\n2) Kosongkan kuota lalu submit",
        "Expected Result": "Sistem menampilkan pesan error Kuota Wajib Diisi",
        "Referensi Figma": "https://figma.com/file/crm-test",
      },
      {
        "ID": "TC-PKT-002",
        "Area": "Paket RS",
        "Judul Testcase": "Verifikasi pembuatan paket dengan kuota valid",
        "Prioritas": "Critical",
        "Tipe": "Functional",
        "Role": "RS_Finance",
        "Prasyarat": "Ada data master",
        "Langkah": "1) Isi semua field valid\n2) Submit form",
        "Expected Result": "Paket berhasil dibuat dan tersimpan",
        "Referensi Figma": "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "TC_Paket_RS");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const parsed = parseTestCaseWorkbook(buffer);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].code, "TC-PKT-001");
    assert.equal(parsed[0].moduleArea, "Paket RS");
    assert.equal(parsed[0].priority, "HIGH");
    assert.equal(parsed[1].priority, "CRITICAL");
  });

  await t.test("Fail test run item creates bug draft idempotently", async () => {
    // Setup test project
    const project = await prisma.project.create({
      data: {
        key: `P2B${Date.now().toString().slice(-4)}`,
        name: "Phase 2B Test Project",
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `tester_${Date.now()}@example.com`,
        name: "QA Tester",
        status: "ACTIVE",
      },
    });

    const tc = await prisma.testCase.create({
      data: {
        projectId: project.id,
        code: "TC-TEST-001",
        title: "Test login negative invalid credentials",
        priority: "HIGH",
        moduleArea: "Auth",
        steps: "1. Buka login\n2. Masukkan password salah\n3. Klik masuk",
        expectedResult: "Pesan error invalid password muncul",
      },
    });

    const run = await prisma.testRun.create({
      data: {
        projectId: project.id,
        name: "Sprint 14 Regression",
        environment: "Staging",
        buildVersion: "v2.0.1",
        createdById: user.id,
      },
    });

    const item = await prisma.testRunItem.create({
      data: {
        testRunId: run.id,
        testCaseId: tc.id,
        status: "FAIL",
        actualResult: "Muncul 500 Internal Server Error",
        executedById: user.id,
      },
    });

    // 1. Create bug draft from test run item
    const firstResult = await createBugDraftFromTestRunItem({
      testRunItemId: item.id,
      actorId: user.id,
      actorEmail: user.email,
    });

    assert.equal(firstResult.created, true);
    assert.equal(firstResult.bug.status, "DRAFT");
    assert.equal(firstResult.bug.title, "[Fail] Test login negative invalid credentials");
    assert.equal(firstResult.bug.environment, "Staging");
    assert.equal(firstResult.bug.buildNumber, "v2.0.1");
    assert.equal(firstResult.bug.actualResult, "Muncul 500 Internal Server Error");

    // 2. Second execution must be idempotent (no duplicate bug created)
    const secondResult = await createBugDraftFromTestRunItem({
      testRunItemId: item.id,
      actorId: user.id,
      actorEmail: user.email,
    });

    assert.equal(secondResult.created, false);
    assert.equal(secondResult.bug.id, firstResult.bug.id);
  });
});
