import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import { recordAuditLog } from "@/lib/user-service";
import { logAttempt, linkBugToItem } from "@/lib/testrun-service";
import { agentReadiness, fillTestData } from "@/lib/agent-readiness";
import { notifyAgentSessionSummary } from "@/lib/notification-service";

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // decision: >10 MB via MCP base64 -> agent sends a link instead
const EVIDENCE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", webm: "video/webm", mp4: "video/mp4", txt: "text/plain", log: "text/plain" };
export const evidencePath = (projectKey: string, storedName: string) => path.join(process.cwd(), "uploads", projectKey, "evidence", path.basename(storedName));

// F9: tools for a QA's local agent. Every write is done as the key owner (actor), labelled "via agent".
export const LEASE_MS = 90_000; // AC-AG-04: no heartbeat for >90s = lease expired ("Terputus")

export type AgentCtx = { projectId: string; projectKey: string; apiKeyId: string; actorId: string; actorEmail: string };
export type AgentResult<T = object> = ({ ok: true } & T) | { error: string };
const err = (error: string) => ({ error });
const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u);
const countSteps = (steps: string) => Math.max(1, steps.match(/(?:^|\s)\d+\)/g)?.length ?? 1);

async function ownSession(ctx: AgentCtx, sessionId?: unknown) {
  if (!sessionId) return null;
  return prisma.agentRun.findFirst({ where: { id: String(sessionId), projectId: ctx.projectId, apiKeyId: ctx.apiKeyId } });
}

export async function startSession(ctx: AgentCtx, a: { agentName?: string; toolName?: string; workdir?: string; testRunId?: string }) {
  const agentName = a.agentName?.trim();
  if (!agentName) return err("agentName wajib diisi.");
  if (a.testRunId && !(await prisma.testRun.findFirst({ where: { id: a.testRunId, projectId: ctx.projectId }, select: { id: true } }))) return err("Test run tidak ditemukan di project ini.");
  const s = await prisma.agentRun.create({
    data: { projectId: ctx.projectId, apiKeyId: ctx.apiKeyId, agentName, toolName: a.toolName?.trim() || null, workdir: a.workdir?.trim() || null, testRunId: a.testRunId || null, runId: `session_${randomUUID()}` },
  });
  return { ok: true as const, sessionId: s.id };
}

export async function createTestRun(ctx: AgentCtx, a: { name?: string; environment?: string; buildVersion?: string; testCaseCodes?: string[] }) {
  const name = a.name?.trim();
  if (!name) return err("name wajib diisi.");
  const codes = (a.testCaseCodes ?? []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  const cases = await prisma.testCase.findMany({
    where: { projectId: ctx.projectId, status: "READY", ...(codes.length ? { code: { in: codes } } : { agentReady: true }) },
    select: { id: true, code: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } } },
  });
  if (!cases.length) return err("Tidak ada test case Siap yang cocok (tanpa kode, hanya yang 'Siap untuk agent' dipakai).");
  const run = await prisma.testRun.create({
    data: {
      projectId: ctx.projectId, name, environment: a.environment?.trim() || "Staging", buildVersion: a.buildVersion?.trim() || null, createdById: ctx.actorId,
      items: { create: cases.map((c) => ({ testCaseId: c.id, testCaseVersionId: c.versions[0]?.id })) },
    },
  });
  return { ok: true as const, testRunId: run.id, items: cases.length, codes: cases.map((c) => c.code) };
}

export async function getTestRun(ctx: AgentCtx, testRunId: string) {
  const run = await prisma.testRun.findFirst({
    where: { id: testRunId, projectId: ctx.projectId },
    include: { items: { include: { testCase: { select: { code: true, title: true } } }, orderBy: { testCase: { code: "asc" } } } },
  });
  if (!run) return err("Test run tidak ditemukan di project ini.");
  const now = new Date();
  return {
    ok: true as const, id: run.id, name: run.name, status: run.status, environment: run.environment, buildVersion: run.buildVersion,
    items: run.items.map((i) => ({ itemId: i.id, code: i.testCase.code, title: i.testCase.title, status: i.status, needsRerun: i.needsRerun, running: Boolean(i.leaseExpiresAt && i.leaseExpiresAt > now) })),
  };
}

// AC-AG-04: one atomic conditional update decides the winner; a second agent gets count 0 and moves on.
export async function claimItem(ctx: AgentCtx, a: { testRunId?: string; itemId?: string; agentName?: string; sessionId?: string }) {
  const session = await ownSession(ctx, a.sessionId);
  if (a.sessionId && !session) return err("Sesi tidak ditemukan atau bukan milik key ini.");
  const agentName = (a.agentName?.trim() || session?.agentName || "agent").slice(0, 60);
  const now = new Date();
  const free = { OR: [{ runningByUserId: null }, { leaseExpiresAt: { lt: now } }] };
  const base = { testRun: { projectId: ctx.projectId, status: "IN_PROGRESS" as const, ...(a.testRunId ? { id: a.testRunId } : session?.testRunId ? { id: session.testRunId } : {}) } };
  const candidates = await prisma.testRunItem.findMany({
    where: a.itemId ? { id: a.itemId, ...base } : { ...base, ...free, testCase: { agentReady: true }, OR: [{ status: "NOT_RUN" }, { needsRerun: true }] },
    orderBy: { testCase: { code: "asc" } },
    take: 10,
    select: { id: true },
  });
  for (const c of candidates) {
    const won = await prisma.testRunItem.updateMany({
      where: { id: c.id, ...free },
      data: { runningByUserId: ctx.actorId, runningAgentName: agentName, runningSince: now, heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), currentStep: 1, totalSteps: null },
    });
    if (won.count !== 1) continue;
    const item = await prisma.testRunItem.findUniqueOrThrow({
      where: { id: c.id },
      include: { testRun: { select: { id: true, environment: true, buildVersion: true } }, testCase: true, testCaseVersion: { select: { version: true } } },
    });
    const totalSteps = countSteps(item.testCase.steps);
    await prisma.testRunItem.update({ where: { id: c.id }, data: { totalSteps } });
    return {
      ok: true as const, itemId: item.id, testRunId: item.testRun.id, environment: item.testRun.environment, buildVersion: item.testRun.buildVersion,
      code: item.testCase.code, title: item.testCase.title, version: item.testCaseVersion?.version ?? null, totalSteps, leaseSeconds: LEASE_MS / 1000,
      precondition: item.testCase.precondition, steps: fillTestData(item.testCase.steps, item.testCase.testData), expectedResult: item.testCase.expectedResult,
    };
  }
  return err(a.itemId ? "Item tidak ada atau sedang dijalankan agent lain." : "Tidak ada item yang bisa diklaim.");
}

export async function heartbeat(ctx: AgentCtx, a: { itemId?: string; step?: number; totalSteps?: number }) {
  if (!a.itemId) return err("itemId wajib diisi.");
  const now = new Date();
  const r = await prisma.testRunItem.updateMany({
    where: { id: a.itemId, runningByUserId: ctx.actorId, testRun: { projectId: ctx.projectId } },
    data: {
      heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      ...(Number.isInteger(a.step) ? { currentStep: a.step } : {}), ...(Number.isInteger(a.totalSteps) ? { totalSteps: a.totalSteps } : {}),
    },
  });
  return r.count === 1 ? { ok: true as const, leaseSeconds: LEASE_MS / 1000 } : err("Lease tidak dimiliki key ini. Klaim item lagi.");
}

type RecordInput = {
  itemId?: string; result?: string; actualResult?: string; failedStep?: number; blockedReason?: string; buildVersion?: string; environment?: string;
  toolName?: string; links?: string[]; evidenceIds?: string[]; notes?: string; sessionId?: string;
};

// AC-AG-05: FAIL needs failedStep + evidence; same rules as a human attempt (logAttempt), recorded as the key owner.
export async function recordResult(ctx: AgentCtx, a: RecordInput) {
  if (!a.itemId) return err("itemId wajib diisi.");
  const result = String(a.result ?? "").toUpperCase();
  const session = await ownSession(ctx, a.sessionId);
  if (a.sessionId && !session) return err("Sesi tidak ditemukan atau bukan milik key ini.");
  const item = await prisma.testRunItem.findFirst({ where: { id: a.itemId, testRun: { projectId: ctx.projectId } }, select: { runningByUserId: true, leaseExpiresAt: true } });
  if (!item) return err("Item tidak ditemukan.");
  if (item.runningByUserId && item.runningByUserId !== ctx.actorId && item.leaseExpiresAt && item.leaseExpiresAt > new Date()) return err("Item sedang dijalankan agent lain.");

  const links = (a.links ?? []).map((l) => String(l).trim()).filter(Boolean);
  if (links.some((l) => !isUrl(l))) return err("Semua link bukti harus diawali http:// atau https://.");
  const evidenceIds = [...new Set((a.evidenceIds ?? []).map(String))];
  const files = evidenceIds.length
    ? await prisma.evidence.findMany({ where: { id: { in: evidenceIds }, projectId: ctx.projectId, uploadedById: ctx.actorId, attemptId: null, purgedAt: null } })
    : [];
  if (files.length !== evidenceIds.length) return err("evidenceIds tidak valid: file tidak ada, sudah terpakai, atau bukan milik key ini.");
  const notes: string[] = [];
  if (result === "FAIL") {
    if (!Number.isInteger(a.failedStep) || (a.failedStep as number) < 1) return err("failedStep wajib (nomor langkah yang gagal) untuk hasil Gagal.");
    if (!links.length && !files.length) return err("Bukti wajib untuk hasil Gagal: kirim minimal satu file (upload_evidence) atau link bukti.");
    notes.push(`Langkah gagal: ${a.failedStep}`);
  }
  if (result === "BLOCKED") {
    if (!a.blockedReason?.trim()) return err("blockedReason wajib untuk hasil Terblokir.");
    notes.push(`Terblokir: ${a.blockedReason.trim()}`);
  } else if (result === "SKIPPED") {
    notes.push(a.blockedReason?.trim() || "");
  }
  if (a.notes?.trim()) notes.push(a.notes.trim());
  if (links.length > 1) notes.push(`Bukti lain: ${links.slice(1).join(" ")}`);

  const r = await logAttempt({ id: ctx.actorId, email: ctx.actorEmail }, ctx.projectId, a.itemId, {
    result,
    actualResult: redactSecrets(a.actualResult ?? ""),
    notes: redactSecrets(notes.filter(Boolean).join("\n")),
    build: a.buildVersion,
    environment: a.environment,
    evidenceUrl: links[0],
    hasFileEvidence: files.length > 0,
    agent: { name: session?.agentName ?? "agent", toolName: a.toolName ?? session?.toolName ?? undefined, sessionId: session?.id },
  });
  if ("error" in r) return r;
  if (files.length) {
    const att = await prisma.testRunAttempt.findFirstOrThrow({ where: { itemId: a.itemId }, orderBy: { seq: "desc" }, select: { id: true } });
    await prisma.evidence.updateMany({ where: { id: { in: files.map((f) => f.id) } }, data: { attemptId: att.id } });
  }
  const purged = result === "PASS" ? await purgeItemEvidence(ctx.projectKey, a.itemId) : 0;
  await recordAuditLog({ projectId: ctx.projectId, actorId: ctx.actorId, actorEmail: ctx.actorEmail, actorType: "agent", action: "testrun.agent_result", entityType: "test_run_item", entityId: a.itemId, changes: { after: { result, sessionId: session?.id ?? null } } });
  return { ok: true as const, result, ...(purged ? { evidencePurged: purged } : {}) };
}

// AC-AG-06: link an existing bug and leave one evidence comment instead of a duplicate draft.
export async function linkBug(ctx: AgentCtx, a: { itemId?: string; bugKey?: string; comment?: string }) {
  if (!a.itemId || !a.bugKey) return err("itemId dan bugKey wajib diisi.");
  const r = await linkBugToItem(ctx.projectId, a.itemId, a.bugKey);
  if ("error" in r) return r;
  const bug = await prisma.bug.findFirstOrThrow({ where: { projectId: ctx.projectId, key: a.bugKey.trim().toUpperCase() }, select: { id: true } });
  const body = redactSecrets((a.comment ?? "").trim());
  if (body) await prisma.bugComment.create({ data: { bugId: bug.id, authorId: ctx.actorId, body: `[Agent Comment]\n${body}`, type: "PUBLIC" } });
  return { ok: true as const };
}

export async function finishSession(ctx: AgentCtx, a: { sessionId?: string; summary?: string }) {
  const s = await ownSession(ctx, a.sessionId);
  if (!s) return err("Sesi tidak ditemukan atau bukan milik key ini.");
  if (s.finishedAt) return err("Sesi sudah selesai.");
  const attempts = await prisma.testRunAttempt.findMany({ where: { agentSessionId: s.id }, select: { result: true } });
  const count = (r: string) => attempts.filter((x) => x.result === r).length;
  const newBugs = await prisma.bug.count({ where: { agentRunId: s.id } });
  const linkedBugs = await prisma.testRunItemBug.count({ where: { attempt: { agentSessionId: s.id }, OR: [{ bug: { agentRunId: null } }, { bug: { agentRunId: { not: s.id } } }] } });
  const summary = { total: attempts.length, passed: count("PASS"), failed: count("FAIL"), blocked: count("BLOCKED"), skipped: count("SKIPPED"), newBugs, linkedBugs, text: redactSecrets(a.summary?.trim() ?? "") };
  await prisma.agentRun.update({ where: { id: s.id }, data: { finishedAt: new Date(), summary } });
  await notifyAgentSessionSummary([ctx.actorId], {
    sessionId: s.id, projectId: ctx.projectId, sessionTitle: s.testRunId ? "Test run" : "Sesi agent", agentName: s.agentName,
    totalResults: summary.total, passed: summary.passed, failed: summary.failed, blocked: summary.blocked, newBugsCount: newBugs,
    href: s.testRunId ? `/projects/${ctx.projectKey}/test-runs/${s.testRunId}` : `/projects/${ctx.projectKey}`,
  });
  return { ok: true as const, summary };
}

export async function listAgentTestCases(ctx: AgentCtx, a: { query?: string; priority?: string; includeMissing?: boolean }) {
  const cases = await prisma.testCase.findMany({
    where: {
      projectId: ctx.projectId, status: "READY",
      ...(a.includeMissing ? {} : { agentReady: true }),
      ...(a.query ? { title: { contains: a.query, mode: "insensitive" as const } } : {}),
      ...(a.priority ? { priority: a.priority as never } : {}),
    },
    orderBy: { code: "asc" }, take: 100,
  });
  return {
    ok: true as const,
    cases: cases.map((c) => ({ code: c.code, title: c.title, priority: c.priority, agentReady: c.agentReady, ...(a.includeMissing ? { missing: agentReadiness(c).missing } : {}) })),
  };
}

export async function uploadEvidence(ctx: AgentCtx, a: { fileName?: string; dataBase64?: string; sessionId?: string }) {
  const ext = String(a.fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  const mimeType = EVIDENCE_TYPES[ext];
  if (!mimeType) return err(`Tipe file tidak didukung. Boleh: ${Object.keys(EVIDENCE_TYPES).join(", ")}.`);
  if (!a.dataBase64) return err("dataBase64 wajib diisi.");
  if (a.sessionId && !(await ownSession(ctx, a.sessionId))) return err("Sesi tidak ditemukan atau bukan milik key ini.");
  const buf = Buffer.from(String(a.dataBase64).replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buf.length) return err("File kosong.");
  if (buf.length > MAX_EVIDENCE_BYTES) return err("Ukuran file melebihi 10 MB. Unggah ke tempat lain dan kirim link lewat 'links'.");
  const fileName = String(a.fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const id = randomUUID();
  const storedName = `${id}_${fileName}`;
  const file = evidencePath(ctx.projectKey, storedName);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  await prisma.evidence.create({ data: { id, projectId: ctx.projectId, uploadedById: ctx.actorId, sessionId: a.sessionId || null, fileName, storedName, mimeType, fileSize: buf.length } });
  return { ok: true as const, evidenceId: id, fileName, fileSize: buf.length };
}

// Passing item = proof no longer needed: delete files of every attempt of the item (rows stay, purgedAt set).
export async function purgeItemEvidence(projectKey: string, itemId: string) {
  const rows = await prisma.evidence.findMany({ where: { purgedAt: null, attempt: { itemId } } });
  for (const e of rows) await fs.rm(evidencePath(projectKey, e.storedName), { force: true });
  if (rows.length) await prisma.evidence.updateMany({ where: { id: { in: rows.map((e) => e.id) } }, data: { purgedAt: new Date() } });
  return rows.length;
}
