"use server";

import { requireProjectPermission } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import type { TestCasePriority } from "@prisma/client";
import type { ActionResult } from "@/components/ui/action-form";
import { saveTestCaseCore, deleteTestCaseCore } from "@/lib/testcase-service";

export async function upsertSingleTestCase(
  projectId: string,
  projectKey: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireProjectPermission(projectId, "testcase.manage");

  const id = formData.get("id")?.toString().trim();
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
    id: id || undefined,
    code: code || undefined,
    title,
    moduleId,
    priority,
    testType,
    targetRole,
    precondition,
    steps,
    expectedResult,
    referenceUrl,
  });

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
