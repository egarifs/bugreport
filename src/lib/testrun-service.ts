import { prisma } from "@/lib/db";
import { BugSeverity, BugPriority } from "@prisma/client";
import { recordAuditLog } from "./user-service";

export interface CreateBugFromTestRunParams {
  testRunItemId: string;
  actorId: string;
  actorEmail: string;
  isAdmin?: boolean;
}

export async function createBugDraftFromTestRunItem({
  testRunItemId,
  actorId,
  actorEmail,
}: CreateBugFromTestRunParams) {
  const item = await prisma.testRunItem.findUnique({
    where: { id: testRunItemId },
    include: {
      testRun: true,
      testCase: {
        include: { project: true },
      },
      createdBug: true,
    },
  });

  if (!item) {
    throw new Error("Test run item not found");
  }

  // Idempotency: return existing bug if already created
  if (item.createdBug) {
    return { bug: item.createdBug, created: false };
  }

  const project = item.testCase.project;

  // Map priority
  let bugPriority: BugPriority = BugPriority.NORMAL;
  let bugSeverity: BugSeverity = BugSeverity.MEDIUM;
  if (item.testCase.priority === "CRITICAL") {
    bugPriority = BugPriority.URGENT;
    bugSeverity = BugSeverity.BLOCKER;
  } else if (item.testCase.priority === "HIGH") {
    bugPriority = BugPriority.HIGH;
    bugSeverity = BugSeverity.HIGH;
  } else if (item.testCase.priority === "LOW") {
    bugPriority = BugPriority.LOW;
    bugSeverity = BugSeverity.LOW;
  }

  // Assemble contextual description
  const descriptionParts: string[] = [];
  if (item.testCase.moduleArea) descriptionParts.push(`Area: ${item.testCase.moduleArea}`);
  if (item.testCase.targetRole) descriptionParts.push(`Role Pengguna: ${item.testCase.targetRole}`);
  if (item.testCase.precondition) descriptionParts.push(`Prasyarat: ${item.testCase.precondition}`);
  if (item.notes) descriptionParts.push(`Catatan Tester: ${item.notes}`);
  if (item.testCase.referenceUrl) descriptionParts.push(`Referensi: ${item.testCase.referenceUrl}`);
  descriptionParts.push(`Sumber Test Run: ${item.testRun.name} (${item.testRun.environment})`);

  // Transaction for atomic sequence increment and bug creation
  const createdBug = await prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id: project.id },
      data: { bugSeq: { increment: 1 } },
      select: { bugSeq: true },
    });

    const seq = updatedProject.bugSeq;
    const bugKey = `${project.key}-${seq}`;

    return tx.bug.create({
      data: {
        projectId: project.id,
        number: seq,
        key: bugKey,
        title: `[Fail] ${item.testCase.title}`,
        description: descriptionParts.join("\n"),
        stepsToReproduce: item.testCase.steps,
        expectedResult: item.testCase.expectedResult,
        actualResult: item.actualResult || "Pengujian menghasilkan kegagalan pada test case.",
        severity: bugSeverity,
        priority: bugPriority,
        status: "DRAFT",
        environment: item.testRun.environment,
        buildNumber: item.testRun.buildVersion || undefined,
        component: item.testCase.moduleArea || undefined,
        reporterId: actorId,
        testRunItemId: item.id,
      },
    });
  });

  await recordAuditLog({
    projectId: project.id,
    actorId,
    actorEmail,
    action: "bug.create_from_test_run",
    entityType: "bug",
    entityId: createdBug.id,
    changes: {
      after: {
        testRunItemId: item.id,
        testCaseCode: item.testCase.code,
        bugKey: createdBug.key,
      },
    },
  });

  return { bug: createdBug, created: true };
}
