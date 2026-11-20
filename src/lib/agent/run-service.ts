import { prisma } from "@/lib/db";
import { agentReadiness } from "@/lib/agent-readiness";
import { err } from "./shared";
import type { AgentCtx } from "./shared";

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
