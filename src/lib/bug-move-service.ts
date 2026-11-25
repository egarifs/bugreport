import { BugStatus } from "@prisma/client";
import { prisma } from "./db";
import { guardBugTransition } from "./bug-transition";
import { needsDetailPage } from "./bug-board";
import { recordAuditLog } from "./user-service";
import { notifyBug } from "./notify";
import { flagRerunForBug } from "./testrun-service";
import type { checkProjectPermission } from "./authz";

type Actor = Awaited<ReturnType<typeof checkProjectPermission>>;

// Status change from a board drag. Same gate, audit and notification as the detail page,
// restricted to moves that need no extra input. Caller must already be a project member.
export async function moveBugStatus(actor: Actor, projectId: string, bugId: string, target: BugStatus) {
  if (!Object.values(BugStatus).includes(target)) return { error: "Status tujuan tidak valid." };
  const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId } });
  if (!bug) return { error: "Bug tidak ditemukan." };
  if (bug.status === target) return { ok: "Status tidak berubah." };
  if (needsDetailPage(bug.status, target)) return { error: "Perpindahan ini perlu data tambahan. Buka detail bug." };

  const g = await guardBugTransition(bug, projectId, target, actor);
  if (!g.allowed) return { error: "Role Anda tidak bisa mengubah status ke pilihan ini." };

  // Compare-and-set so a stale board cannot overwrite a status someone else just changed.
  const res = await prisma.bug.updateMany({ where: { id: bug.id, status: bug.status }, data: { status: target } });
  if (res.count === 0) return { error: "Status bug sudah berubah. Muat ulang board." };

  await recordAuditLog({
    projectId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "bug.status_change",
    entityType: "bug",
    entityId: bug.id,
    changes: { before: { status: bug.status }, after: { status: target, via: "board" } },
  });
  await notifyBug(bug.id, actor, { kind: "status", from: bug.status, to: target });
  if (target === BugStatus.READY_FOR_VERIFICATION) await flagRerunForBug(bug.id, actor);
  return { ok: "Status diubah." };
}
