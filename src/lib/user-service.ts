import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "./db";
import { notifyAdminsPendingUser } from "./notify";

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isConfiguredAdmin(email: string): boolean {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export async function upsertGoogleUser(profile: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = profile.email.trim().toLowerCase();
  const isAdmin = isConfiguredAdmin(email);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email,
        name: profile.name ?? null,
        image: profile.image ?? null,
        isAdmin,
        status: isAdmin ? UserStatus.ACTIVE : UserStatus.PENDING,
      },
    });
    if (created.status === UserStatus.PENDING) await notifyAdminsPendingUser(created);
    return created;
  }

  // If already exists and is configured admin, ensure isAdmin + ACTIVE
  if (isAdmin && (!existing.isAdmin || existing.status !== UserStatus.ACTIVE)) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        isAdmin: true,
        status: UserStatus.ACTIVE,
        name: profile.name ?? existing.name,
        image: profile.image ?? existing.image,
      },
    });
  }

  return existing;
}

export interface AuditLogInput {
  projectId?: string | null;
  actorId?: string | null;
  actorEmail: string;
  actorType?: "user" | "agent" | "system";
  action: string;
  entityType: string;
  entityId: string;
  changes?: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  } | null;
}

export async function recordAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      projectId: input.projectId ?? null,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail,
      actorType: input.actorType ?? "user",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: input.changes ? (input.changes as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}
