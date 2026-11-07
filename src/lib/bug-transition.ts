import type { BugStatus, ProjectRole } from "@prisma/client";
import { canTransitionBug } from "./permissions";
import { recordAuditLog } from "./user-service";

type Actor = { id: string; email: string; isAdmin: boolean; role: ProjectRole | null };

// Server-side gate for status changes. A denied attempt is audited (AC-PERM-01).
export async function guardBugTransition(
  bug: { id: string; status: BugStatus },
  projectId: string,
  target: BugStatus,
  actor: Actor,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const check = canTransitionBug(bug.status, target, actor.role, actor.isAdmin);
  if (check.allowed) return { allowed: true };
  await recordAuditLog({
    projectId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "bug.status_change_denied",
    entityType: "bug",
    entityId: bug.id,
    changes: { before: { status: bug.status }, after: { status: target, reason: check.reason ?? null } },
  });
  return { allowed: false, reason: check.reason ?? "Forbidden" };
}
