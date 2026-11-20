import { purgeItemEvidence } from "./evidence-service";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import { recordAuditLog } from "@/lib/user-service";
import { logAttempt } from "@/lib/testrun-service";
import { err, isUrl, ownSession } from "./shared";
import type { AgentCtx } from "./shared";

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
  if (session && session.status !== "RUNNING") return err("Sesi sudah selesai dan tidak dapat mencatat hasil.");
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
    failedStep: Number.isInteger(a.failedStep) ? a.failedStep : undefined,
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
