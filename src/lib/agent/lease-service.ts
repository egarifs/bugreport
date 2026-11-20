import { prisma } from "@/lib/db";
import { fillTestData } from "@/lib/agent-readiness";
import { LEASE_MS, err, countSteps, ownSession } from "./shared";
import type { AgentCtx } from "./shared";

// AC-AG-04: one atomic conditional update decides the winner; a second agent gets count 0 and moves on.
export async function claimItem(ctx: AgentCtx, a: { testRunId?: string; itemId?: string; agentName?: string; sessionId?: string }) {
  const session = await ownSession(ctx, a.sessionId);
  if (a.sessionId && !session) return err("Sesi tidak ditemukan atau bukan milik key ini.");
  if (session && session.status !== "RUNNING") return err("Sesi sudah selesai dan tidak dapat mengklaim item baru.");
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
    where: { id: a.itemId, runningByUserId: ctx.actorId, leaseExpiresAt: { gt: now }, testRun: { projectId: ctx.projectId } },
    data: {
      heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      ...(Number.isInteger(a.step) ? { currentStep: a.step } : {}), ...(Number.isInteger(a.totalSteps) ? { totalSteps: a.totalSteps } : {}),
    },
  });
  return r.count === 1 ? { ok: true as const, leaseSeconds: LEASE_MS / 1000 } : err("Lease tidak dimiliki key ini. Klaim item lagi.");
}
