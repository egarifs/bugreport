import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import { notifyAgentSessionSummary } from "@/lib/notification-service";
import { err, ownSession } from "./shared";
import type { AgentCtx } from "./shared";

export async function startSession(ctx: AgentCtx, a: { agentName?: string; toolName?: string; workdir?: string; testRunId?: string }) {
  const agentName = a.agentName?.trim();
  if (!agentName) return err("agentName wajib diisi.");
  if (a.testRunId && !(await prisma.testRun.findFirst({ where: { id: a.testRunId, projectId: ctx.projectId }, select: { id: true } }))) return err("Test run tidak ditemukan di project ini.");
  const s = await prisma.agentRun.create({
    data: { projectId: ctx.projectId, apiKeyId: ctx.apiKeyId, agentName, toolName: a.toolName?.trim() || null, workdir: a.workdir?.trim() || null, testRunId: a.testRunId || null, runId: `session_${randomUUID()}` },
  });
  return { ok: true as const, sessionId: s.id };
}

export async function finishSession(ctx: AgentCtx, a: { sessionId?: string; summary?: string; failed?: boolean }) {
  const s = await ownSession(ctx, a.sessionId);
  if (!s) return err("Sesi tidak ditemukan atau bukan milik key ini.");
  if (s.finishedAt) return err("Sesi sudah selesai.");
  const attempts = await prisma.testRunAttempt.findMany({ where: { agentSessionId: s.id }, select: { result: true } });
  const count = (r: string) => attempts.filter((x) => x.result === r).length;
  const newBugs = await prisma.bug.count({ where: { agentRunId: s.id } });
  const linkedBugs = await prisma.testRunItemBug.count({ where: { attempt: { agentSessionId: s.id }, OR: [{ bug: { agentRunId: null } }, { bug: { agentRunId: { not: s.id } } }] } });
  const summary = { total: attempts.length, passed: count("PASS"), failed: count("FAIL"), blocked: count("BLOCKED"), skipped: count("SKIPPED"), newBugs, linkedBugs, text: redactSecrets(a.summary?.trim() ?? "") };
  await prisma.agentRun.update({ where: { id: s.id }, data: { finishedAt: new Date(), status: a.failed ? "FAILED" : "COMPLETED", summary } });
  await notifyAgentSessionSummary([ctx.actorId], {
    sessionId: s.id, projectId: ctx.projectId, sessionTitle: s.testRunId ? "Test run" : "Sesi agent", agentName: s.agentName,
    totalResults: summary.total, passed: summary.passed, failed: summary.failed, blocked: summary.blocked, newBugsCount: newBugs,
    href: s.testRunId ? `/projects/${ctx.projectKey}/test-runs/${s.testRunId}` : `/projects/${ctx.projectKey}`,
  });
  return { ok: true as const, summary };
}
