import { prisma } from "./db";

export function activeModules(projectId: string) {
  return prisma.module.findMany({
    where: { projectId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

// Case-insensitive match against active modules; unknown names return null (never auto-create).
export async function resolveModuleId(projectId: string, name: string | null | undefined) {
  const n = name?.trim();
  if (!n) return null;
  const m = await prisma.module.findFirst({
    where: { projectId, archivedAt: null, name: { equals: n, mode: "insensitive" } },
    select: { id: true },
  });
  return m?.id ?? null;
}

// Validates a moduleId submitted from a form belongs to the project and is active.
export async function ownModuleId(projectId: string, moduleId: string | null | undefined) {
  if (!moduleId) return null;
  const m = await prisma.module.findFirst({ where: { id: moduleId, projectId, archivedAt: null }, select: { id: true } });
  return m?.id ?? null;
}
