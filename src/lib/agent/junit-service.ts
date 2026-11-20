import { prisma } from "@/lib/db";
import { parseJUnit } from "@/lib/junit-import";
import { logAttempt } from "@/lib/testrun-service";
import { isUrl } from "./shared";
import type { AgentCtx } from "./shared";

export async function importJUnitResults(ctx: AgentCtx, args: Record<string, unknown>) {
  const testRunId = String(args.testRunId ?? "");
  const sessionId = String(args.sessionId ?? "");
  const xml = String(args.xml ?? "");
  const sourceUrl = args.sourceUrl ? String(args.sourceUrl) : undefined;
  if (!testRunId || !sessionId || !xml) return { error: "testRunId, sessionId, dan xml wajib diisi." };
  const session = await prisma.agentRun.findFirst({ where: { id: sessionId, projectId: ctx.projectId, apiKeyId: ctx.apiKeyId } });
  if (!session) return { error: "Sesi tidak ditemukan atau bukan milik key ini." };
  if (session.status !== "RUNNING") return { error: "Sesi sudah selesai dan tidak dapat mengimpor hasil." };
  const run = await prisma.testRun.findFirst({ where: { id: testRunId, projectId: ctx.projectId, status: "IN_PROGRESS" }, select: { id: true, environment: true, buildVersion: true } });
  if (!run) return { error: "Test run tidak ditemukan, berbeda project, atau sudah ditutup." };
  if (sourceUrl && !isUrl(sourceUrl)) return { error: "sourceUrl harus URL http(s)." };
  let cases;
  try { cases = parseJUnit(xml); } catch (error) { return { error: error instanceof Error ? error.message : "JUnit XML tidak valid." }; }
  const items = await prisma.testRunItem.findMany({ where: { testRunId, testCase: { code: { in: cases.flatMap((item) => item.code ? [item.code] : []) } } }, include: { testCase: { select: { code: true } }, testCaseVersion: { select: { version: true } } } });
  const byCode = new Map(items.map((item) => [item.testCase.code.toUpperCase(), item]));
  const imported: string[] = [], missing: string[] = [], skipped: string[] = [];
  for (const result of cases) {
    if (!result.code || !byCode.has(result.code)) { missing.push(result.name); continue; }
    const item = byCode.get(result.code)!;
    const outcome = await logAttempt({ id: ctx.actorId, email: ctx.actorEmail }, ctx.projectId, item.id, { result: result.result, actualResult: result.actualResult, failedStep: result.result === "FAIL" ? 1 : undefined, notes: result.skippedReason, build: run.buildVersion ?? undefined, environment: run.environment, evidenceUrl: sourceUrl, hasFileEvidence: false, agent: { name: session.agentName, toolName: session.toolName ?? undefined, sessionId: session.id } });
    if ("error" in outcome) { skipped.push(`${result.name}: ${outcome.error}`); continue; }
    imported.push(result.code);
  }
  return { ok: true as const, imported, missing, skipped, total: cases.length };
}

