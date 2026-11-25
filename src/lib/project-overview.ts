import { prisma } from "@/lib/db";
import type { BugSeverity, BugStatus, ProjectRole } from "@prisma/client";

const ACTIVE: readonly BugStatus[] = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED"];
export type ProjectFilter = "mine" | "all" | "archive";

/** Ringkas bug satu project: aktif, penghalang rilis (Blocker/High aktif), dan draf menunggu review. Murni. */
export function summarizeBugs(rows: { status: BugStatus; severity: BugSeverity; n: number }[]) {
  let active = 0, blockers = 0, drafts = 0;
  for (const r of rows) {
    if (r.status === "DRAFT") drafts += r.n;
    if (ACTIVE.includes(r.status)) {
      active += r.n;
      if (r.severity === "BLOCKER" || r.severity === "HIGH") blockers += r.n;
    }
  }
  return { active, blockers, drafts };
}

export interface ProjectRow {
  id: string; key: string; name: string; members: number; role: ProjectRole | null;
  active: number; blockers: number; drafts: number; lastActivity: Date | null; isTest: boolean; isArchived: boolean;
}

/** Daftar project untuk halaman Semua project. Agregat dihitung dengan groupBy, bukan per project. Latihan orang lain tidak pernah muncul. */
export async function projectOverview(user: { id: string; isAdmin: boolean }, filter: ProjectFilter, q: string): Promise<ProjectRow[]> {
  const visible = { OR: [{ isSandbox: false }, { sandboxOwnerId: user.id }] };
  const text = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { key: { contains: q, mode: "insensitive" as const } }] } : {};
  const scope = filter === "mine" || !user.isAdmin ? { members: { some: { userId: user.id } } } : {};
  const projects = await prisma.project.findMany({
    where: { AND: [visible, text, scope, { isArchived: filter === "archive" }] },
    select: { id: true, key: true, name: true, isTest: true, isArchived: true, _count: { select: { members: true } }, members: { where: { userId: user.id }, select: { role: true } } },
    take: 300,
  });
  const ids = projects.map((p) => p.id);
  const [counts, recent] = await Promise.all([
    prisma.bug.groupBy({ by: ["projectId", "status", "severity"], where: { projectId: { in: ids } }, _count: { _all: true } }),
    prisma.bug.groupBy({ by: ["projectId"], where: { projectId: { in: ids } }, _max: { updatedAt: true } }),
  ]);
  const lastOf = new Map(recent.map((r) => [r.projectId, r._max.updatedAt]));
  return projects
    .map((p) => {
      const s = summarizeBugs(counts.filter((c) => c.projectId === p.id).map((c) => ({ status: c.status, severity: c.severity, n: c._count._all })));
      return { id: p.id, key: p.key, name: p.name, members: p._count.members, role: p.members[0]?.role ?? null, ...s, lastActivity: lastOf.get(p.id) ?? null, isTest: p.isTest, isArchived: p.isArchived };
    })
    .sort((a, b) => +(b.lastActivity ?? 0) - +(a.lastActivity ?? 0) || a.name.localeCompare(b.name));
}
