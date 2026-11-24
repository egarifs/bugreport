import { auth } from "./auth";
import { prisma } from "./db";
import { hasPermission, type Permission } from "./permissions";
import { pendingMayAccess } from "./sandbox";

// Server actions are public endpoints: re-check session, user status and membership from DB on every call.
export async function requireProjectPermission(projectId: string, permission: Permission) {
  const sessionUser = (await auth())?.user as { id?: string } | undefined;
  return checkProjectPermission(sessionUser?.id, projectId, permission);
}

export async function checkProjectPermission(userId: string | undefined, projectId: string, permission: Permission) {
  if (!userId) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { where: { projectId } } },
  });
  if (!user) throw new Error("Unauthorized");
  if (user.status !== "ACTIVE") {
    // PENDING hanya boleh di project Latihan miliknya; status lain (REJECTED, SUSPENDED) tidak boleh di mana pun.
    const project = user.status === "PENDING" ? await prisma.project.findUnique({ where: { id: projectId }, select: { isSandbox: true, sandboxOwnerId: true } }) : null;
    if (!project || !pendingMayAccess(user, project)) throw new Error("Unauthorized");
  }
  const role = user.memberships[0]?.role ?? null;
  if (!hasPermission(role, permission, user.isAdmin)) throw new Error("Forbidden");
  return { id: user.id, email: user.email, isAdmin: user.isAdmin, role };
}

export async function requireAdmin() {
  const sessionUser = (await auth())?.user as { id?: string } | undefined;
  const user = sessionUser?.id ? await prisma.user.findUnique({ where: { id: sessionUser.id } }) : null;
  if (!user || user.status !== "ACTIVE" || !user.isAdmin) throw new Error("Forbidden");
  return { id: user.id, email: user.email };
}
