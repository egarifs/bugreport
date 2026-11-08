import { BugStatus } from "@prisma/client";
import { prisma } from "./db";
import { guardBugTransition } from "./bug-transition";
import { recordAuditLog } from "./user-service";
import { notifyBug } from "./notify";

type Actor = Parameters<typeof guardBugTransition>[3];

// Build label as shown to users: "1.8.0 · b214" (either part may be missing).
export function buildLabel(version?: string | null, build?: string | null) {
  return [version, build].filter(Boolean).join(" · ");
}

// "1 Nov · lewat" — text, not only color (AC-BUG-07). Terminal bugs never show "lewat".
export function dueLabel(dueAt: Date, status: BugStatus, now = new Date()) {
  const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(dueAt);
  const done = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"].includes(status);
  return { text: !done && dueAt < now ? `${day} · lewat` : day, overdue: !done && dueAt < now };
}

// QA/Admin verify a fix. pass -> CLOSED (+verifiedAt/InBuild); fail -> REOPENED (reason required).
export async function verifyBug(actor: Actor, projectId: string, bugId: string, outcome: "pass" | "fail", reason = "") {
  const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId } });
  if (!bug) return { error: "Bug tidak ditemukan." };
  if (bug.status !== BugStatus.READY_FOR_VERIFICATION) return { error: "Bug ini tidak sedang menunggu verifikasi." };
  const why = reason.trim();
  if (outcome === "fail" && !why) return { error: "Alasan wajib diisi." };

  const target = outcome === "pass" ? BugStatus.CLOSED : BugStatus.REOPENED;
  const g = await guardBugTransition(bug, projectId, target, actor);
  if (!g.allowed) return { error: "Role Anda tidak bisa memverifikasi bug." };

  const build = buildLabel(bug.fixedInVersion, bug.fixedInBuild) || null;
  // Conditional update: a concurrent verification must not apply twice.
  const { count } = await prisma.bug.updateMany({
    where: { id: bug.id, status: BugStatus.READY_FOR_VERIFICATION },
    data:
      outcome === "pass"
        ? { status: target, verifiedAt: new Date(), verifiedInBuild: build }
        : { status: target, reopenCount: { increment: 1 }, reopenReason: why },
  });
  if (!count) return { error: "Status bug sudah berubah. Muat ulang halaman." };

  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email,
    action: "bug.status_change", entityType: "bug", entityId: bug.id,
    changes: { before: { status: bug.status }, after: { status: target, verifiedInBuild: outcome === "pass" ? build : undefined, reopenReason: outcome === "fail" ? why : undefined } },
  });
  await notifyBug(bug.id, actor, { kind: "status", from: bug.status, to: target });
  return { ok: outcome === "pass" ? `${bug.key} ditutup.` : `${bug.key} dibuka kembali.` };
}
