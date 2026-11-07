import { BugPriority, BugSeverity, BugStatus } from "@prisma/client";
import { prisma } from "./db";
import { guardBugTransition } from "./bug-transition";
import { ownModuleId } from "./modules";
import { recordAuditLog } from "./user-service";
import { notifyBug } from "./notify";
import type { checkProjectPermission } from "./authz";

type Actor = Awaited<ReturnType<typeof checkProjectPermission>>;
export type TriageInput = {
  severity?: string; priority?: string; moduleId?: string | null; assigneeId?: string | null;
  accept?: boolean; reject?: boolean;
};

// Triage a DRAFT bug: set severity/priority/module/assignee, optionally accept (OPEN) or reject (INVALID).
// Caller must already hold bug.review; transition is re-checked and denials audited.
export async function triageBug(actor: Actor, projectId: string, bugId: string, input: TriageInput) {
  const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId } });
  if (!bug) return { error: "Bug tidak ditemukan." };
  if (bug.status !== BugStatus.DRAFT) return { error: "Hanya draft yang bisa ditriase." };

  const severity = Object.values(BugSeverity).find((s) => s === input.severity) ?? bug.severity;
  const priority = Object.values(BugPriority).find((p) => p === input.priority) ?? bug.priority;
  const moduleId = input.moduleId === undefined ? bug.moduleId : await ownModuleId(projectId, input.moduleId);
  let assigneeId = input.assigneeId === undefined ? bug.assigneeId : input.assigneeId || null;
  if (assigneeId && !(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: assigneeId } } }))) {
    assigneeId = bug.assigneeId;
  }

  const target = input.accept ? BugStatus.OPEN : input.reject ? BugStatus.INVALID : null;
  if (target === BugStatus.OPEN) {
    if (!moduleId) return { error: "Pilih modul sebelum menerima bug." };
    if (!(bug.appVersion || bug.buildNumber)) return { error: "Bug belum punya versi/build; isi di halaman detail." };
  }
  if (target) {
    const g = await guardBugTransition(bug, projectId, target, actor);
    if (!g.allowed) return { error: "Role Anda tidak bisa mengubah status ke pilihan ini." };
  }

  await prisma.bug.update({
    where: { id: bug.id },
    data: {
      severity, priority, moduleId, assigneeId,
      ...(target ? { status: target } : {}),
      ...(target === BugStatus.OPEN ? { reviewedById: actor.id, reviewedAt: new Date() } : {}),
    },
  });
  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email,
    action: target ? "bug.status_change" : "bug.triage", entityType: "bug", entityId: bug.id,
    changes: {
      before: { status: bug.status, severity: bug.severity, priority: bug.priority, moduleId: bug.moduleId, assigneeId: bug.assigneeId },
      after: { status: target ?? bug.status, severity, priority, moduleId, assigneeId },
    },
  });
  if (target) await notifyBug(bug.id, actor, { kind: "status", from: bug.status, to: target });
  else if (assigneeId && assigneeId !== bug.assigneeId) await notifyBug(bug.id, actor, { kind: "assign" });
  return { ok: target === BugStatus.OPEN ? `${bug.key} diterima.` : target ? `${bug.key} ditolak.` : "Triase disimpan." };
}

// Start of today in WIB (UTC+7), as a UTC Date.
export function startOfTodayWib(now = new Date()) {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 3600_000);
}
