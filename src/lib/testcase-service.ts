import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import type { TestCasePriority, TestCaseStatus, Prisma } from "@prisma/client";

export type TestCaseSnapshot = {
  code: string;
  title: string;
  moduleId: string | null;
  moduleArea: string | null;
  priority: TestCasePriority;
  status: TestCaseStatus;
  testType: string | null;
  targetRole: string | null;
  precondition: string | null;
  steps: string;
  expectedResult: string;
  referenceUrl: string | null;
};

export type TestCaseInput = {
  id?: string;
  code?: string;
  title: string;
  moduleId?: string | null;
  priority?: TestCasePriority;
  status?: TestCaseStatus;
  testType?: string | null;
  targetRole?: string | null;
  precondition?: string | null;
  steps: string;
  expectedResult: string;
  referenceUrl?: string | null;
  changelog?: string | null;
  userId?: string | null;
};

function hasCoreChanges(oldData: TestCaseSnapshot, newData: TestCaseSnapshot): boolean {
  return (
    oldData.title !== newData.title ||
    oldData.steps !== newData.steps ||
    oldData.expectedResult !== newData.expectedResult ||
    oldData.priority !== newData.priority ||
    oldData.testType !== newData.testType ||
    oldData.targetRole !== newData.targetRole ||
    oldData.precondition !== newData.precondition ||
    oldData.referenceUrl !== newData.referenceUrl ||
    oldData.moduleId !== newData.moduleId ||
    oldData.status !== newData.status
  );
}

export async function saveTestCaseCore(
  projectId: string,
  projectKey: string,
  input: TestCaseInput
): Promise<{ ok?: string; error?: string; id?: string; code?: string; version?: number }> {
  const title = redactSecrets(input.title.trim());
  const steps = redactSecrets(input.steps.trim());
  const expectedResult = redactSecrets(input.expectedResult.trim());

  if (!title) return { error: "Judul test case wajib diisi." };
  if (!steps) return { error: "Langkah-langkah pengujian (steps) wajib diisi." };
  if (!expectedResult) return { error: "Hasil yang diharapkan (expected result) wajib diisi." };

  let moduleArea: string | null = null;
  if (input.moduleId) {
    const mod = await prisma.module.findUnique({ where: { id: input.moduleId } });
    if (mod) moduleArea = mod.name;
  }

  let code = input.code?.trim().toUpperCase();
  if (!code) {
    const count = await prisma.testCase.count({ where: { projectId } });
    const prefix = moduleArea
      ? moduleArea.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
      : projectKey;
    code = `TC-${prefix || "GEN"}-${String(count + 1).padStart(3, "0")}`;
  }

  const priority = input.priority || "MEDIUM";
  const status = input.status || "READY";
  const testType = input.testType?.trim() || null;
  const targetRole = input.targetRole?.trim() || null;
  const precondition = input.precondition ? redactSecrets(input.precondition.trim()) : null;
  const referenceUrl = input.referenceUrl?.trim() || null;

  // Resolve existing record by id OR by (projectId, code)
  let existingId = input.id;
  if (!existingId && code) {
    const found = await prisma.testCase.findUnique({
      where: {
        projectId_code: {
          projectId,
          code,
        },
      },
      select: { id: true },
    });
    if (found) existingId = found.id;
  }

  // 1. UPDATE EXISTING
  if (existingId) {
    const existing = await prisma.testCase.findUnique({
      where: { id: existingId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!existing || existing.projectId !== projectId) {
      return { error: "Test case tidak ditemukan." };
    }

    const currentSnapshot: TestCaseSnapshot = {
      code: existing.code,
      title: existing.title,
      moduleId: existing.moduleId,
      moduleArea: existing.moduleArea,
      priority: existing.priority,
      status: existing.status,
      testType: existing.testType,
      targetRole: existing.targetRole,
      precondition: existing.precondition,
      steps: existing.steps,
      expectedResult: existing.expectedResult,
      referenceUrl: existing.referenceUrl,
    };

    const newSnapshot: TestCaseSnapshot = {
      code,
      title,
      moduleId: input.moduleId || null,
      moduleArea,
      priority,
      status,
      testType,
      targetRole,
      precondition,
      steps,
      expectedResult,
      referenceUrl,
    };

    const isChanged = hasCoreChanges(currentSnapshot, newSnapshot);
    let nextVersion = existing.versions[0]?.version || 1;
    const changelog = input.changelog?.trim() || `Pembaruan versi ${nextVersion + 1}`;

    if (isChanged) {
      nextVersion += 1;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const tc = await tx.testCase.update({
        where: { id: existingId },
        data: {
          code,
          title,
          moduleId: input.moduleId || null,
          moduleArea,
          priority,
          status,
          testType,
          targetRole,
          precondition,
          steps,
          expectedResult,
          referenceUrl,
        },
      });

      if (isChanged) {
        await tx.testCaseVersion.create({
          data: {
            testCaseId: tc.id,
            version: nextVersion,
            changelog,
            snapshot: newSnapshot as unknown as Prisma.InputJsonValue,
            createdById: input.userId || null,
          },
        });
      }

      return tc;
    });

    return {
      ok: `Test case ${code} berhasil diperbarui (v${nextVersion}).`,
      id: updated.id,
      code: updated.code,
      version: nextVersion,
    };
  }

  // 2. CREATE NEW
  const newSnapshot: TestCaseSnapshot = {
    code,
    title,
    moduleId: input.moduleId || null,
    moduleArea,
    priority,
    status,
    testType,
    targetRole,
    precondition,
    steps,
    expectedResult,
    referenceUrl,
  };

  const created = await prisma.$transaction(async (tx) => {
    const tc = await tx.testCase.create({
      data: {
        projectId,
        code,
        title,
        status,
        moduleId: input.moduleId || null,
        moduleArea,
        priority,
        testType,
        targetRole,
        precondition,
        steps,
        expectedResult,
        referenceUrl,
      },
    });

    await tx.testCaseVersion.create({
      data: {
        testCaseId: tc.id,
        version: 1,
        changelog: input.changelog?.trim() || "Test case dibuat",
        snapshot: newSnapshot as unknown as Prisma.InputJsonValue,
        createdById: input.userId || null,
      },
    });

    return tc;
  });

  return {
    ok: `Test case ${code} berhasil disimpan (v1).`,
    id: created.id,
    code: created.code,
    version: 1,
  };
}

export async function bulkMoveTestCases(
  projectId: string,
  testCaseIds: string[],
  moduleId: string | null
): Promise<{ ok?: string; error?: string; count?: number }> {
  if (!testCaseIds.length) {
    return { error: "Tidak ada test case yang dipilih." };
  }

  let moduleArea: string | null = null;
  if (moduleId) {
    const mod = await prisma.module.findFirst({
      where: { id: moduleId, projectId },
    });
    if (!mod) return { error: "Modul tujuan tidak valid." };
    moduleArea = mod.name;
  }

  const result = await prisma.testCase.updateMany({
    where: {
      id: { in: testCaseIds },
      projectId,
    },
    data: {
      moduleId: moduleId || null,
      moduleArea,
    },
  });

  return {
    ok: `${result.count} test case berhasil dipindahkan.`,
    count: result.count,
  };
}

export async function setTestCaseStatus(
  projectId: string,
  id: string,
  status: TestCaseStatus,
  userId?: string
): Promise<{ ok?: string; error?: string }> {
  const tc = await prisma.testCase.findFirst({
    where: { id, projectId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!tc) return { error: "Test case tidak ditemukan." };
  if (tc.status === status) return { ok: `Status test case sudah ${status}.` };

  const currentVersion = tc.versions[0]?.version || 1;
  const nextVersion = currentVersion + 1;

  const currentSnapshot = (tc.versions[0]?.snapshot as unknown as TestCaseSnapshot) || {
    code: tc.code,
    title: tc.title,
    moduleId: tc.moduleId,
    moduleArea: tc.moduleArea,
    priority: tc.priority,
    status: tc.status,
    testType: tc.testType,
    targetRole: tc.targetRole,
    precondition: tc.precondition,
    steps: tc.steps,
    expectedResult: tc.expectedResult,
    referenceUrl: tc.referenceUrl,
  };

  const newSnapshot: TestCaseSnapshot = {
    ...currentSnapshot,
    status,
  };

  const changelog =
    status === "DEPRECATED"
      ? "Ditandai sebagai usang (deprecated)"
      : status === "READY"
      ? "Diaktifkan kembali (siap)"
      : "Status diubah ke Draf";

  await prisma.$transaction(async (tx) => {
    await tx.testCase.update({
      where: { id },
      data: { status },
    });

    await tx.testCaseVersion.create({
      data: {
        testCaseId: id,
        version: nextVersion,
        changelog,
        snapshot: newSnapshot as unknown as Prisma.InputJsonValue,
        createdById: userId || null,
      },
    });
  });

  return { ok: `Status test case ${tc.code} berhasil diubah ke ${status}.` };
}

export async function getTestCaseDetail(projectId: string, id: string) {
  return prisma.testCase.findFirst({
    where: { id, projectId },
    include: {
      module: { select: { id: true, name: true } },
      versions: {
        orderBy: { version: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
      runItems: {
        orderBy: { testRun: { createdAt: "desc" } },
        include: {
          testRun: { select: { id: true, name: true, environment: true, createdAt: true } },
          executedBy: { select: { id: true, name: true, email: true } },
          bugLinks: { select: { bug: { select: { id: true, key: true, number: true, title: true, status: true } } } },
          attempts: { orderBy: { seq: "desc" }, take: 1, select: { build: true, viaAgent: true } },
        },
      },
    },
  });
}

export async function deleteTestCaseCore(
  projectId: string,
  id: string
): Promise<{ ok?: string; error?: string }> {
  const item = await prisma.testCase.findUnique({
    where: { id },
    include: {
      runItems: {
        select: { id: true, testRun: { select: { name: true } } },
        take: 1,
      },
    },
  });

  if (!item || item.projectId !== projectId) {
    return { error: "Test case tidak ditemukan." };
  }

  if (item.runItems.length > 0) {
    return {
      error: `Tidak dapat menghapus: Test case ${item.code} sudah pernah dieksekusi di test run "${item.runItems[0].testRun.name}".`,
    };
  }

  await prisma.testCase.delete({ where: { id } });
  return { ok: `Test case ${item.code} berhasil dihapus.` };
}
