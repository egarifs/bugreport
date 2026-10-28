import { prisma } from "./db";
import { BugStatus } from "@prisma/client";

const DONE: BugStatus[] = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];
const DRAFT_STALE_DAYS = 3;

export async function getProjectReport(projectId: string, targetVersion?: string) {
  const active = { projectId, status: { notIn: DONE } };
  const staleBefore = new Date(Date.now() - DRAFT_STALE_DAYS * 86_400_000);
  // ponytail: version match = appVersion OR buildNumber exact; add release entity if teams need ranges.
  const versionFilter = targetVersion
    ? { OR: [{ appVersion: targetVersion }, { buildNumber: targetVersion }] }
    : {};

  const [byStatus, openBySeverity, reopened, staleDrafts, workload, releaseBlockers] = await Promise.all([
    prisma.bug.groupBy({ by: ["status"], where: { projectId }, _count: true }),
    prisma.bug.groupBy({ by: ["severity"], where: active, _count: true }),
    prisma.bug.count({ where: { projectId, reopenCount: { gt: 0 } } }),
    prisma.bug.findMany({
      where: { projectId, status: "DRAFT", createdAt: { lt: staleBefore } },
      select: { key: true, title: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.bug.groupBy({ by: ["assigneeId"], where: active, _count: true }),
    prisma.bug.findMany({
      where: { ...active, severity: { in: ["BLOCKER", "HIGH"] }, ...versionFilter },
      select: { key: true, title: true, severity: true, status: true },
      orderBy: { severity: "asc" },
    }),
  ]);

  const assignees = await prisma.user.findMany({
    where: { id: { in: workload.map((w) => w.assigneeId).filter((id): id is string => !!id) } },
    select: { id: true, name: true, email: true },
  });
  const nameOf = (id: string | null) => {
    const u = assignees.find((a) => a.id === id);
    return u ? u.name || u.email : "Unassigned";
  };

  return {
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Partial<Record<BugStatus, number>>,
    openBySeverity: Object.fromEntries(openBySeverity.map((s) => [s.severity, s._count])) as Record<string, number>,
    reopened,
    staleDrafts,
    workload: workload
      .map((w) => ({ assignee: nameOf(w.assigneeId), count: w._count }))
      .sort((a, b) => b.count - a.count),
    releaseBlockers,
    releaseReady: releaseBlockers.length === 0,
  };
}

// Neutralize spreadsheet formula injection (=,+,-,@) and quote per RFC 4180.
export function csvCell(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const CSV_COLUMNS = [
  "key", "title", "status", "severity", "priority", "environment", "appVersion",
  "buildNumber", "module", "reporter", "assignee", "reopenCount", "createdAt", "updatedAt",
] as const;

// Export only bug fields; comments (incl. internal notes) never included, so safe for every role.
export async function exportBugsCsv(projectId: string): Promise<string> {
  const bugs = await prisma.bug.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
    include: {
      reporter: { select: { email: true } },
      assignee: { select: { email: true } },
      module: { select: { name: true } },
    },
  });
  const rows = bugs.map((b) =>
    CSV_COLUMNS.map((c) =>
      csvCell(
        c === "reporter" ? b.reporter.email
        : c === "assignee" ? b.assignee?.email
        : c === "module" ? (b.module?.name ?? b.component)
        : b[c]
      )
    ).join(",")
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}
