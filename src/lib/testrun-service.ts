import { prisma } from "@/lib/db";
import { BugSeverity, BugPriority, BugStatus, TestRunDecision, TestRunItemStatus } from "@prisma/client";
import { notifyBug, notifyRerunRequired } from "./notify";
import { buildLabel } from "./verify-service";
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
      attempts: { orderBy: { seq: "desc" }, take: 1 },
    },
  });

  if (!item) {
    throw new Error("Test run item not found");
  }

  // Idempotency per attempt: one draft per failed attempt; a later failed attempt may open another bug.
  const attemptId = item.attempts[0]?.id ?? null;
  const existing = await prisma.testRunItemBug.findFirst({
    where: { itemId: item.id, attemptId },
    include: { bug: true },
  });
  if (existing) return { bug: existing.bug, created: false };

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
        moduleId: item.testCase.moduleId,
        reporterId: actorId,
        testRunLinks: { create: { itemId: item.id, attemptId } },
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
  await notifyBug(createdBug.id, { id: actorId, email: actorEmail }, { kind: "draft", source: "test_run" });

  return { bug: createdBug, created: true };
}

type Actor = { id: string; email: string };
type Result<T = object> = ({ ok: string } & T) | { error: string };

const isUrl = (v: string) => {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

async function loadItem(projectId: string, itemId: string) {
  return prisma.testRunItem.findFirst({
    where: { id: itemId, testRun: { projectId } },
    include: { testRun: true, testCaseVersion: { select: { version: true } } },
  });
}

// AC-RUN-01/04: every run is a new attempt; item status mirrors the latest attempt, nothing is overwritten.
export async function logAttempt(
  actor: Actor,
  projectId: string,
  itemId: string,
  input: { result: string; actualResult?: string; notes?: string; build?: string; evidenceUrl?: string; environment?: string; agent?: { name: string; toolName?: string; sessionId?: string } },
): Promise<Result> {
  const item = await loadItem(projectId, itemId);
  if (!item) return { error: "Item tidak ditemukan." };
  if (item.testRun.status !== "IN_PROGRESS") return { error: "Test run sudah ditutup. Buka kembali untuk mencatat percobaan." };
  const result = input.result as TestRunItemStatus;
  if (!["PASS", "FAIL", "BLOCKED", "SKIPPED"].includes(result)) return { error: "Hasil tidak valid." };
  const actualResult = input.actualResult?.trim() || null;
  const notes = input.notes?.trim() || null;
  const evidenceUrl = input.evidenceUrl?.trim() || null;
  if (result === "SKIPPED" && !notes) return { error: "Alasan wajib diisi untuk item yang dilewati." };
  if (result === "FAIL" && !actualResult) return { error: "Hasil aktual wajib diisi saat gagal." };
  if (result === "FAIL" && !evidenceUrl) return { error: "Bukti wajib saat gagal: isi link screenshot atau rekaman." };
  if (evidenceUrl && !isUrl(evidenceUrl)) return { error: "Link bukti harus diawali http:// atau https://." };

  await prisma.$transaction(async (tx) => {
    const last = await tx.testRunAttempt.findFirst({ where: { itemId }, orderBy: { seq: "desc" }, select: { seq: true } });
    await tx.testRunAttempt.create({
      data: {
        itemId,
        seq: (last?.seq ?? 0) + 1,
        result,
        actualResult,
        notes,
        evidenceUrl,
        build: input.build?.trim() || item.testRun.buildVersion,
        environment: input.environment?.trim() || item.testRun.environment,
        testCaseVersionId: item.testCaseVersionId,
        executedById: actor.id,
        viaAgent: Boolean(input.agent),
        agentName: input.agent?.name ?? null,
        toolName: input.agent?.toolName ?? null,
        agentSessionId: input.agent?.sessionId ?? null,
      },
    });
    await tx.testRunItem.update({
      where: { id: itemId },
      data: {
        status: result,
        actualResult,
        notes,
        skipReason: result === "SKIPPED" ? notes : null,
        executedById: actor.id,
        executedAt: new Date(),
        needsRerun: false,
        rerunBuild: null,
        rerunBugId: null,
        // a recorded result ends any agent lease
        runningByUserId: null, runningAgentName: null, runningSince: null, heartbeatAt: null, leaseExpiresAt: null, currentStep: null, totalSteps: null,
      },
    });
  });
  return { ok: "Percobaan dicatat." };
}

// AC-RUN-03: link an existing bug to an item (many-to-many).
export async function linkBugToItem(projectId: string, itemId: string, bugKey: string): Promise<Result> {
  const item = await loadItem(projectId, itemId);
  if (!item) return { error: "Item tidak ditemukan." };
  const bug = await prisma.bug.findFirst({ where: { projectId, key: bugKey.trim().toUpperCase() }, select: { id: true } });
  if (!bug) return { error: "Bug tidak ditemukan di project ini." };
  const last = await prisma.testRunAttempt.findFirst({ where: { itemId }, orderBy: { seq: "desc" }, select: { id: true } });
  await prisma.testRunItemBug.upsert({
    where: { itemId_bugId: { itemId, bugId: bug.id } },
    create: { itemId, bugId: bug.id, attemptId: last?.id ?? null },
    update: {},
  });
  return { ok: "Bug ditautkan." };
}

// AC-TC-02: move item to the newest test case version. Old attempts keep their old version.
export async function updateItemVersion(actor: Actor, projectId: string, itemId: string): Promise<Result> {
  const item = await loadItem(projectId, itemId);
  if (!item) return { error: "Item tidak ditemukan." };
  if (item.testRun.status !== "IN_PROGRESS") return { error: "Test run sudah ditutup." };
  const latest = await prisma.testCaseVersion.findFirst({ where: { testCaseId: item.testCaseId }, orderBy: { version: "desc" } });
  if (!latest || latest.id === item.testCaseVersionId) return { error: "Item sudah memakai versi terbaru." };
  const hasAttempts = (await prisma.testRunAttempt.count({ where: { itemId } })) > 0;
  await prisma.testRunItem.update({
    where: { id: itemId },
    data: {
      testCaseVersionId: latest.id,
      ...(hasAttempts ? { status: "NOT_RUN", actualResult: null, notes: null, skipReason: null, needsRerun: false, rerunBuild: null, rerunBugId: null } : {}),
    },
  });
  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email,
    action: "test_run.item_version_update", entityType: "test_run_item", entityId: itemId,
    changes: { before: { version: item.testCaseVersion?.version ?? null }, after: { version: latest.version } },
  });
  return { ok: `Diperbarui ke v${latest.version}.` };
}

export async function updateAllItemVersions(actor: Actor, projectId: string, runId: string): Promise<Result> {
  const items = await prisma.testRunItem.findMany({ where: { testRunId: runId, testRun: { projectId } }, select: { id: true } });
  let n = 0;
  for (const i of items) if ("ok" in (await updateItemVersion(actor, projectId, i.id))) n++;
  return n ? { ok: `${n} item diperbarui.` } : { error: "Semua item sudah memakai versi terbaru." };
}

// AC-RUN-05: close run. Items still NOT_RUN must each be resolved to SKIPPED (reason required) or BLOCKED.
export async function closeRun(
  actor: Actor,
  projectId: string,
  runId: string,
  input: { decision: string; note?: string; resolutions?: Record<string, { result: string; reason?: string }> },
): Promise<Result> {
  const run = await prisma.testRun.findFirst({ where: { id: runId, projectId }, include: { items: { select: { id: true, status: true } } } });
  if (!run) return { error: "Test run tidak ditemukan." };
  if (run.status !== "IN_PROGRESS") return { error: "Test run sudah ditutup." };
  if (!Object.values(TestRunDecision).includes(input.decision as TestRunDecision)) return { error: "Pilih keputusan run." };
  const note = input.note?.trim() || null;
  if (input.decision !== "PASS" && !note) return { error: "Catatan wajib untuk keputusan selain Lolos." };

  const pending = run.items.filter((i) => i.status === "NOT_RUN");
  for (const i of pending) {
    const r = input.resolutions?.[i.id];
    if (!r || !["SKIPPED", "BLOCKED"].includes(r.result)) return { error: "Tentukan Dilewati atau Terblokir untuk setiap item yang belum dijalankan." };
    if (r.result === "SKIPPED" && !r.reason?.trim()) return { error: "Alasan wajib diisi untuk item yang dilewati." };
  }
  for (const i of pending) {
    const r = input.resolutions![i.id];
    const res = await logAttempt(actor, projectId, i.id, { result: r.result, notes: r.reason });
    if ("error" in res) return res;
  }
  await prisma.testRun.update({
    where: { id: runId },
    data: { status: "COMPLETED", decision: input.decision as TestRunDecision, decisionNote: note, closedAt: new Date(), closedById: actor.id },
  });
  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email,
    action: "test_run.close", entityType: "test_run", entityId: runId,
    changes: { after: { decision: input.decision, note, resolved: pending.length } },
  });
  return { ok: "Test run ditutup." };
}

export async function reopenRun(actor: Actor, projectId: string, runId: string): Promise<Result> {
  const run = await prisma.testRun.findFirst({ where: { id: runId, projectId } });
  if (!run) return { error: "Test run tidak ditemukan." };
  if (run.status === "IN_PROGRESS") return { error: "Test run sudah terbuka." };
  await prisma.testRun.update({ where: { id: runId }, data: { status: "IN_PROGRESS", decision: null, decisionNote: null, closedAt: null, closedById: null } });
  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email,
    action: "test_run.reopen", entityType: "test_run", entityId: runId,
    changes: { before: { decision: run.decision, decisionNote: run.decisionNote } },
  });
  return { ok: "Test run dibuka kembali." };
}

// AC-RUN-02: bug is ready for verification -> items whose latest attempt FAILed/BLOCKED and link to it need a re-run.
export async function flagRerunForBug(bugId: string, actor: { id?: string; email?: string | null }) {
  const bug = await prisma.bug.findUnique({ where: { id: bugId }, select: { id: true, key: true, projectId: true, status: true, fixedInVersion: true, fixedInBuild: true, project: { select: { key: true } } } });
  if (!bug || bug.status !== BugStatus.READY_FOR_VERIFICATION) return 0;
  const build = buildLabel(bug.fixedInVersion, bug.fixedInBuild) || null;
  const items = await prisma.testRunItem.findMany({
    where: { bugLinks: { some: { bugId } }, status: { in: ["FAIL", "BLOCKED"] }, testRun: { status: "IN_PROGRESS" } },
    include: { testRun: true, testCase: { select: { code: true, title: true } } },
  });
  for (const it of items) {
    await prisma.testRunItem.update({ where: { id: it.id }, data: { needsRerun: true, rerunBuild: build, rerunBugId: bug.id } });
    await notifyRerunRequired({
      testRunId: it.testRunId,
      testRunTitle: it.testRun.name,
      itemTitle: `${it.testCase.code} ${it.testCase.title} · ${bug.key} siap diverifikasi${build ? ` di build ${build}` : ""}`,
      projectId: bug.projectId,
      projectKey: bug.project.key,
      targetUserIds: [it.executedById ?? it.testRun.createdById, it.testRun.createdById],
      actor,
    });
  }
  return items.length;
}
