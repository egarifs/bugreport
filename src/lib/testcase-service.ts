import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import type { TestCasePriority } from "@prisma/client";

export type TestCaseInput = {
  id?: string;
  code?: string;
  title: string;
  moduleId?: string | null;
  priority?: TestCasePriority;
  testType?: string | null;
  targetRole?: string | null;
  precondition?: string | null;
  steps: string;
  expectedResult: string;
  referenceUrl?: string | null;
};

export async function saveTestCaseCore(
  projectId: string,
  projectKey: string,
  input: TestCaseInput
): Promise<{ ok?: string; error?: string; id?: string; code?: string }> {
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

  if (input.id) {
    const updated = await prisma.testCase.update({
      where: { id: input.id },
      data: {
        code,
        title,
        moduleId: input.moduleId || null,
        moduleArea,
        priority,
        testType: input.testType?.trim() || null,
        targetRole: input.targetRole?.trim() || null,
        precondition: input.precondition ? redactSecrets(input.precondition.trim()) : null,
        steps,
        expectedResult,
        referenceUrl: input.referenceUrl?.trim() || null,
      },
    });
    return { ok: `Test case ${code} berhasil diperbarui.`, id: updated.id, code: updated.code };
  }

  const created = await prisma.testCase.upsert({
    where: {
      projectId_code: {
        projectId,
        code,
      },
    },
    create: {
      projectId,
      code,
      title,
      moduleId: input.moduleId || null,
      moduleArea,
      priority,
      testType: input.testType?.trim() || null,
      targetRole: input.targetRole?.trim() || null,
      precondition: input.precondition ? redactSecrets(input.precondition.trim()) : null,
      steps,
      expectedResult,
      referenceUrl: input.referenceUrl?.trim() || null,
    },
    update: {
      title,
      moduleId: input.moduleId || null,
      moduleArea,
      priority,
      testType: input.testType?.trim() || null,
      targetRole: input.targetRole?.trim() || null,
      precondition: input.precondition ? redactSecrets(input.precondition.trim()) : null,
      steps,
      expectedResult,
      referenceUrl: input.referenceUrl?.trim() || null,
    },
  });

  return { ok: `Test case ${code} berhasil disimpan.`, id: created.id, code: created.code };
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
