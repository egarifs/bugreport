"use server";

import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TestCasePriority, TestCaseStatus } from "@prisma/client";
import type { ActionResult } from "@/components/ui/action-form";
import {
  saveTestCaseCore,
  deleteTestCaseCore,
  setTestCaseStatus,
  bulkMoveTestCases,
} from "@/lib/testcase-service";

export async function upsertSingleTestCase(
  projectId: string,
  projectKey: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  await requireProjectPermission(projectId, "testcase.manage");

  const id = formData.get("id")?.toString().trim();
  const code = formData.get("code")?.toString().trim().toUpperCase();
  const title = formData.get("title")?.toString().trim() || "";
  const moduleId = formData.get("moduleId")?.toString().trim() || null;
  const rawPriority = formData.get("priority")?.toString().trim() || "MEDIUM";
  const priority = (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(rawPriority)
    ? rawPriority
    : "MEDIUM") as TestCasePriority;
  const rawStatus = formData.get("status")?.toString().trim() || "READY";
  const status = (["DRAFT", "READY", "DEPRECATED"].includes(rawStatus)
    ? rawStatus
    : "READY") as TestCaseStatus;
  const testType = formData.get("testType")?.toString().trim() || null;
  const targetRole = formData.get("targetRole")?.toString().trim() || null;
  const precondition = formData.get("precondition")?.toString().trim() || null;
  const steps = formData.get("steps")?.toString().trim() || "";
  const expectedResult = formData.get("expectedResult")?.toString().trim() || "";
  const referenceUrl = formData.get("referenceUrl")?.toString().trim() || null;
  const changelog = formData.get("changelog")?.toString().trim() || (id ? "Pembaruan test case" : "Test case dibuat");

  const res = await saveTestCaseCore(projectId, projectKey, {
    id: id || undefined,
    code: code || undefined,
    title,
    moduleId,
    priority,
    status,
    testType,
    targetRole,
    precondition,
    steps,
    expectedResult,
    referenceUrl,
    changelog,
    userId,
  });

  if (res.ok) {
    revalidatePath(`/projects/${projectKey}/test-cases`);
    if (res.id) {
      revalidatePath(`/projects/${projectKey}/test-cases/${res.id}`);
    }
  }
  return res;
}

export async function createTestCaseAction(
  projectId: string,
  projectKey: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult & { id?: string; code?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  await requireProjectPermission(projectId, "testcase.manage");

  const code = formData.get("code")?.toString().trim().toUpperCase();
  const title = formData.get("title")?.toString().trim() || "";
  const moduleId = formData.get("moduleId")?.toString().trim() || null;
  const rawPriority = formData.get("priority")?.toString().trim() || "MEDIUM";
  const priority = (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(rawPriority)
    ? rawPriority
    : "MEDIUM") as TestCasePriority;
  const testType = formData.get("testType")?.toString().trim() || null;
  const targetRole = formData.get("targetRole")?.toString().trim() || null;
  const precondition = formData.get("precondition")?.toString().trim() || null;
  const steps = formData.get("steps")?.toString().trim() || "";
  const expectedResult = formData.get("expectedResult")?.toString().trim() || "";
  const referenceUrl = formData.get("referenceUrl")?.toString().trim() || null;

  const res = await saveTestCaseCore(projectId, projectKey, {
    code: code || undefined,
    title,
    moduleId,
    priority,
    status: "READY",
    testType,
    targetRole,
    precondition,
    steps,
    expectedResult,
    referenceUrl,
    changelog: "Test case dibuat",
    userId,
  });

  if (res.ok && res.id) {
    revalidatePath(`/projects/${projectKey}/test-cases`);
    revalidatePath(`/projects/${projectKey}/test-cases/${res.id}`);
    redirect(`/projects/${projectKey}/test-cases/${res.id}`);
  }
  return res;
}

export async function updateTestCaseAction(
  projectId: string,
  projectKey: string,
  testCaseId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult & { id?: string; code?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  await requireProjectPermission(projectId, "testcase.manage");

  const code = formData.get("code")?.toString().trim().toUpperCase();
  const title = formData.get("title")?.toString().trim() || "";
  const moduleId = formData.get("moduleId")?.toString().trim() || null;
  const rawPriority = formData.get("priority")?.toString().trim() || "MEDIUM";
  const priority = (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(rawPriority)
    ? rawPriority
    : "MEDIUM") as TestCasePriority;
  const rawStatus = formData.get("status")?.toString().trim() || "READY";
  const status = (["DRAFT", "READY", "DEPRECATED"].includes(rawStatus)
    ? rawStatus
    : "READY") as TestCaseStatus;
  const testType = formData.get("testType")?.toString().trim() || null;
  const targetRole = formData.get("targetRole")?.toString().trim() || null;
  const precondition = formData.get("precondition")?.toString().trim() || null;
  const steps = formData.get("steps")?.toString().trim() || "";
  const expectedResult = formData.get("expectedResult")?.toString().trim() || "";
  const referenceUrl = formData.get("referenceUrl")?.toString().trim() || null;
  const changelog = formData.get("changelog")?.toString().trim() || "";

  if (!changelog) {
    return { error: "Catatan perubahan wajib diisi untuk versi baru." };
  }

  const res = await saveTestCaseCore(projectId, projectKey, {
    id: testCaseId,
    code: code || undefined,
    title,
    moduleId,
    priority,
    status,
    testType,
    targetRole,
    precondition,
    steps,
    expectedResult,
    referenceUrl,
    changelog,
    userId,
  });

  if (res.ok && res.id) {
    revalidatePath(`/projects/${projectKey}/test-cases`);
    revalidatePath(`/projects/${projectKey}/test-cases/${res.id}`);
    redirect(`/projects/${projectKey}/test-cases/${res.id}`);
  }
  return res;
}

export async function toggleTestCaseStatusAction(
  projectId: string,
  projectKey: string,
  testCaseId: string,
  targetStatus: TestCaseStatus
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  await requireProjectPermission(projectId, "testcase.manage");

  const res = await setTestCaseStatus(projectId, testCaseId, targetStatus, userId);
  if (res.ok) {
    revalidatePath(`/projects/${projectKey}/test-cases`);
    revalidatePath(`/projects/${projectKey}/test-cases/${testCaseId}`);
  }
  return res;
}

export async function bulkMoveTestCasesAction(
  projectId: string,
  projectKey: string,
  testCaseIds: string[],
  moduleId: string | null
): Promise<ActionResult> {
  await requireProjectPermission(projectId, "testcase.manage");
  const res = await bulkMoveTestCases(projectId, testCaseIds, moduleId);
  if (res.ok) {
    revalidatePath(`/projects/${projectKey}/test-cases`);
  }
  return res;
}

export async function deleteSingleTestCase(
  projectId: string,
  projectKey: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireProjectPermission(projectId, "testcase.manage");

  const id = formData.get("id")?.toString().trim();
  if (!id) return { error: "ID test case tidak valid." };

  const res = await deleteTestCaseCore(projectId, id);
  if (res.ok) {
    revalidatePath(`/projects/${projectKey}/test-cases`);
  }
  return res;
}
