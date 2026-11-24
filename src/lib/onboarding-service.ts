import { prisma } from "@/lib/db";
import { eventsFromFacts, isGuideRole, type GuideRole } from "@/lib/onboarding";
import { seedSandbox } from "@/lib/sandbox-service";

/** Project Latihan milik pengguna; dibuat dan diisi saat pertama dibuka. */
export async function ensureSandbox(userId: string) {
  const existing = await prisma.project.findUnique({ where: { sandboxOwnerId: userId }, select: { id: true, key: true } });
  if (existing) return existing;
  const p = await seedSandbox(userId);
  return { id: p.id, key: p.key };
}

/** Hitung langkah selesai dari aksi nyata pengguna di project Latihan, simpan gabungan (tidak pernah mundur). */
export async function syncProgress(userId: string) {
  const sandbox = await prisma.project.findUnique({ where: { sandboxOwnerId: userId }, select: { id: true } });
  const current = await prisma.onboardingProgress.findUnique({ where: { userId } });
  if (!sandbox) return { guideRole: (isGuideRole(current?.guideRole) ? current!.guideRole : null) as GuideRole | null, completed: current?.completedSteps ?? [] };
  const mine = { projectId: sandbox.id, actorId: userId };
  const [bugsCreated, statusChanges, comments, attempts] = await Promise.all([
    prisma.auditLog.count({ where: { ...mine, action: "bug.create" } }),
    prisma.auditLog.count({ where: { ...mine, action: "bug.status_change" } }),
    prisma.auditLog.count({ where: { ...mine, action: "bug.comment" } }),
    prisma.testRunAttempt.count({ where: { executedById: userId, item: { testRun: { projectId: sandbox.id } } } }),
  ]);
  const completed = [...new Set([...(current?.completedSteps ?? []), ...eventsFromFacts({ bugsCreated, statusChanges, comments, attempts })])];
  const row = await prisma.onboardingProgress.upsert({ where: { userId }, update: { completedSteps: completed }, create: { userId, completedSteps: completed } });
  return { guideRole: (isGuideRole(row.guideRole) ? row.guideRole : null) as GuideRole | null, completed: row.completedSteps };
}

export async function setGuideRole(userId: string, role: GuideRole) {
  await prisma.onboardingProgress.upsert({ where: { userId }, update: { guideRole: role }, create: { userId, guideRole: role } });
}
