import { BugStatus } from "@prisma/client";
import { prisma } from "./db";
import { hasPermission } from "./permissions";
import { moveBugStatus } from "./bug-move-service";
import { addBugTag } from "./bug-tag-service";
import { recordAuditLog } from "./user-service";
import { notifyBug } from "./notify";
import type { checkProjectPermission } from "./authz";

type Actor = Awaited<ReturnType<typeof checkProjectPermission>>;

export const BULK_MAX = 100;

export type BulkOp =
  | { kind: "status"; target: BugStatus }
  | { kind: "assign"; userId: string | null } // null = unassign
  | { kind: "tag"; name: string };

type One = { ok: string } | { error: string };

// Each op returns per-bug results; the shared services keep every rule (guards, audit, notify) in one place.
const handlers: Record<BulkOp["kind"], (actor: Actor, projectId: string, bugId: string, op: never) => Promise<One>> = {
  status: (actor, projectId, bugId, op: Extract<BulkOp, { kind: "status" }>) => moveBugStatus(actor, projectId, bugId, op.target) as Promise<One>,
  tag: (actor, projectId, bugId, op: Extract<BulkOp, { kind: "tag" }>) => addBugTag(actor, projectId, bugId, op.name) as Promise<One>,
  assign: async (actor, projectId, bugId, op: Extract<BulkOp, { kind: "assign" }>) => {
    if (!hasPermission(actor.role, "bug.update", actor.isAdmin)) return { error: "Role Anda tidak bisa mengubah assignee." };
    const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId }, select: { id: true, assigneeId: true } });
    if (!bug) return { error: "Bug tidak ditemukan." };
    if (bug.assigneeId === op.userId) return { ok: "Tidak berubah." };
    await prisma.bug.update({ where: { id: bug.id }, data: { assigneeId: op.userId } });
    await recordAuditLog({
      projectId, actorId: actor.id, actorEmail: actor.email, action: "bug.assign",
      entityType: "bug", entityId: bug.id, changes: { before: { assigneeId: bug.assigneeId }, after: { assigneeId: op.userId, via: "bulk" } },
    });
    if (op.userId) await notifyBug(bug.id, actor, { kind: "assign" });
    return { ok: "Assignee diubah." };
  },
};

// Caller must already be a project member. Returns a summary line; never throws for a single bug's failure.
export async function bulkUpdateBugs(actor: Actor, projectId: string, rawIds: string[], op: BulkOp) {
  const ids = [...new Set(rawIds)].filter(Boolean);
  if (ids.length === 0) return { error: "Pilih minimal satu bug." };
  if (ids.length > BULK_MAX) return { error: `Maksimal ${BULK_MAX} bug sekali jalan.` };

  if (op.kind === "assign" && op.userId) {
    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: op.userId } } });
    if (!member) return { error: "Assignee harus anggota project." };
  }
  if (op.kind === "status" && !Object.values(BugStatus).includes(op.target)) return { error: "Status tujuan tidak valid." };

  let done = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const res = await handlers[op.kind](actor, projectId, id, op as never);
    if ("ok" in res) done++;
    else failures.push(res.error);
  }
  const reason = failures.length ? ` Gagal ${failures.length}: ${[...new Set(failures)][0]}` : "";
  if (done === 0) return { error: `Tidak ada bug yang diubah.${reason}` };
  return { ok: `${done} bug diubah.${reason}` };
}
