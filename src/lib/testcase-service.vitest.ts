import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db";
import {
  saveTestCaseCore,
  setTestCaseStatus,
  bulkMoveTestCases,
  getTestCaseDetail,
} from "./testcase-service";

describe("TestCase Service - Versions and Status (AC-TC-01, AC-TC-02)", () => {
  let projectId: string;
  let userId: string;
  let moduleId1: string;
  let moduleId2: string;
  const projectKey = `TCV_${Date.now().toString(36).toUpperCase()}`.slice(0, 10);

  beforeAll(async () => {
    // Setup test user
    const user = await prisma.user.create({
      data: {
        email: `tcv_${Date.now()}@example.com`,
        name: "Test Case Author",
        isAdmin: true,
        status: "ACTIVE",
      },
    });
    userId = user.id;

    // Setup project
    const project = await prisma.project.create({
      data: {
        key: projectKey,
        name: "Test Case Versioning Test Project",
        isTest: true,
      },
    });
    projectId = project.id;

    // Setup modules
    const m1 = await prisma.module.create({
      data: {
        projectId,
        name: "Authentication",
      },
    });
    moduleId1 = m1.id;

    const m2 = await prisma.module.create({
      data: {
        projectId,
        name: "Checkout",
      },
    });
    moduleId2 = m2.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.testCaseVersion.deleteMany({
      where: { testCase: { projectId } },
    });
    await prisma.testRunItem.deleteMany({
      where: { testCase: { projectId } },
    });
    await prisma.testCase.deleteMany({
      where: { projectId },
    });
    await prisma.module.deleteMany({
      where: { projectId },
    });
    await prisma.project.deleteMany({
      where: { id: projectId },
    });
    await prisma.user.deleteMany({
      where: { id: userId },
    });
  });

  it("creates test case with version 1 and snapshot", async () => {
    const res = await saveTestCaseCore(projectId, projectKey, {
      title: "Verifikasi login gagal jika password salah",
      moduleId: moduleId1,
      priority: "HIGH",
      status: "READY",
      steps: "1. Buka /login\n2. Masukkan password salah\n3. Klik masuk",
      expectedResult: "Pesan error muncul dan user tetap di /login",
      changelog: "Inisial test case",
      userId,
    });

    expect(res.ok).toBeDefined();
    expect(res.id).toBeDefined();
    expect(res.version).toBe(1);

    const detail = await getTestCaseDetail(projectId, res.id!);
    expect(detail).not.toBeNull();
    expect(detail!.status).toBe("READY");
    expect(detail!.versions.length).toBe(1);
    expect(detail!.versions[0].version).toBe(1);
    expect(detail!.versions[0].changelog).toBe("Inisial test case");
    expect(detail!.versions[0].createdById).toBe(userId);
    expect(detail!.versions[0].snapshot).toMatchObject({
      title: "Verifikasi login gagal jika password salah",
      priority: "HIGH",
      status: "READY",
    });
  });

  it("bumps version to 2 on update when snapshot fields change", async () => {
    // 1. Create v1
    const created = await saveTestCaseCore(projectId, projectKey, {
      title: "Tambah produk ke keranjang",
      moduleId: moduleId2,
      priority: "MEDIUM",
      status: "READY",
      steps: "1. Klik Beli",
      expectedResult: "Produk masuk ke keranjang",
      userId,
    });
    const tcId = created.id!;
    expect(created.version).toBe(1);

    // 2. Update with modified steps and mandatory changelog
    const updated = await saveTestCaseCore(projectId, projectKey, {
      id: tcId,
      title: "Tambah produk ke keranjang (Multiple item)",
      moduleId: moduleId2,
      priority: "HIGH",
      steps: "1. Ubah qty jadi 2\n2. Klik Beli",
      expectedResult: "Badge keranjang bertambah 2 item",
      changelog: "Dukungan kuantiti lebih dari 1",
      userId,
    });

    expect(updated.ok).toBeDefined();
    expect(updated.version).toBe(2);

    const detail = await getTestCaseDetail(projectId, tcId);
    expect(detail!.versions.length).toBe(2);
    expect(detail!.versions[0].version).toBe(2);
    expect(detail!.versions[0].changelog).toBe("Dukungan kuantiti lebih dari 1");
    expect(detail!.versions[1].version).toBe(1);
  });

  it("does NOT bump version if snapshot fields remain unchanged", async () => {
    const created = await saveTestCaseCore(projectId, projectKey, {
      title: "Halaman 404 ketika route acak diakses",
      moduleId: moduleId1,
      priority: "LOW",
      status: "READY",
      steps: "1. Buka /halaman-acak-12345",
      expectedResult: "Tampil halaman 404 Not Found",
      userId,
    });
    const tcId = created.id!;

    // Re-save identical content
    const reSaved = await saveTestCaseCore(projectId, projectKey, {
      id: tcId,
      title: "Halaman 404 ketika route acak diakses",
      moduleId: moduleId1,
      priority: "LOW",
      status: "READY",
      steps: "1. Buka /halaman-acak-12345",
      expectedResult: "Tampil halaman 404 Not Found",
      changelog: "Pembaruan tanpa perubahan substansi",
      userId,
    });

    expect(reSaved.ok).toBeDefined();
    expect(reSaved.version).toBe(1); // Tetap v1

    const detail = await getTestCaseDetail(projectId, tcId);
    expect(detail!.versions.length).toBe(1);
  });

  it("generates fallback changelog when programmatic update omits one", async () => {
    const created = await saveTestCaseCore(projectId, projectKey, {
      title: "Filter kategori barang",
      priority: "MEDIUM",
      steps: "1. Pilih kategori Elektronik",
      expectedResult: "Hanya barang elektronik yang tampil",
      userId,
    });
    const tcId = created.id!;

    // Try update with changes but empty changelog
    const failedUpdate = await saveTestCaseCore(projectId, projectKey, {
      id: tcId,
      title: "Filter kategori barang (Updated)",
      priority: "MEDIUM",
      steps: "1. Pilih kategori Elektronik\n2. Pilih subkategori Laptop",
      expectedResult: "Hanya barang laptop yang tampil",
      changelog: "   ",
      userId,
    });

    expect(failedUpdate.ok).toContain("v2");
    const version = await prisma.testCaseVersion.findUnique({
      where: { testCaseId_version: { testCaseId: tcId, version: 2 } },
    });
    expect(version?.changelog).toMatch(/Pembaruan versi 2/i);
  });

  it("updates status (READY -> DEPRECATED -> READY)", async () => {
    const created = await saveTestCaseCore(projectId, projectKey, {
      title: "Legacy feature to be deprecated",
      steps: "1. Klik tombol lama",
      expectedResult: "Berhasil",
      userId,
    });
    const tcId = created.id!;

    // Deprecate
    const resDeprecate = await setTestCaseStatus(projectId, tcId, "DEPRECATED");
    expect(resDeprecate.ok).toBeDefined();

    let detail = await getTestCaseDetail(projectId, tcId);
    expect(detail!.status).toBe("DEPRECATED");

    // Re-activate
    const resActivate = await setTestCaseStatus(projectId, tcId, "READY");
    expect(resActivate.ok).toBeDefined();

    detail = await getTestCaseDetail(projectId, tcId);
    expect(detail!.status).toBe("READY");
  });

  it("bulk moves test cases to another module", async () => {
    const tc1 = await saveTestCaseCore(projectId, projectKey, {
      title: "Bulk TC 1",
      moduleId: moduleId1,
      steps: "1. Langkah 1",
      expectedResult: "Hasil 1",
      userId,
    });
    const tc2 = await saveTestCaseCore(projectId, projectKey, {
      title: "Bulk TC 2",
      moduleId: moduleId1,
      steps: "1. Langkah 2",
      expectedResult: "Hasil 2",
      userId,
    });

    const moveRes = await bulkMoveTestCases(projectId, [tc1.id!, tc2.id!], moduleId2);
    expect(moveRes.ok).toBeDefined();
    expect(moveRes.count).toBe(2);

    const tc1Updated = await getTestCaseDetail(projectId, tc1.id!);
    const tc2Updated = await getTestCaseDetail(projectId, tc2.id!);
    expect(tc1Updated!.moduleId).toBe(moduleId2);
    expect(tc2Updated!.moduleId).toBe(moduleId2);
  });
});
