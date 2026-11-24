import { prisma } from "@/lib/db";
import { adminMetrics, devMetrics, qaMetrics } from "@/lib/performance";

const OPEN = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED"] as const;
const toStatus = (s: string) => ({ path: ["after", "status"], equals: s });

/** Metrik satu orang di satu project dan rentang waktu. Hanya baca data yang sudah ada; tanpa input manual. */
export async function personMetrics(projectId: string, userId: string, from: Date, to: Date) {
  const range = { gte: from, lt: to };
  const events = (status: string) => prisma.auditLog.findMany({ where: { projectId, action: "bug.status_change", actorId: userId, createdAt: range, changes: toStatus(status) }, select: { entityId: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const [versions, attempts, reported, closedEv, triaged, movedEv, active] = await Promise.all([
    prisma.testCaseVersion.findMany({ where: { createdById: userId, createdAt: range, testCase: { projectId } }, select: { version: true } }),
    prisma.testRunAttempt.findMany({ where: { executedById: userId, createdAt: range, item: { testRun: { projectId } } }, select: { viaAgent: true } }),
    prisma.bug.findMany({ where: { projectId, reporterId: userId, createdAt: range }, select: { status: true, severity: true } }),
    events("CLOSED"),
    prisma.bug.findMany({ where: { projectId, reviewedById: userId, reviewedAt: range }, select: { createdAt: true, reviewedAt: true } }),
    events("READY_FOR_VERIFICATION"),
    prisma.bug.findMany({ where: { projectId, status: { in: [...OPEN] }, OR: [{ assigneeId: userId }, { bugAssignees: { some: { userId } } }] }, select: { dueAt: true } }),
  ]);
  const ids = (ev: { entityId: string | null }[]) => [...new Set(ev.map((e) => e.entityId).filter((x): x is string => !!x))];
  const [closedBugs, movedBugs, started] = await Promise.all([
    prisma.bug.findMany({ where: { id: { in: ids(closedEv) }, projectId }, select: { reopenCount: true } }),
    prisma.bug.findMany({ where: { id: { in: ids(movedEv) }, projectId }, select: { id: true, severity: true, dueAt: true, fixedInBuild: true, reopenCount: true, status: true } }),
    prisma.auditLog.findMany({ where: { projectId, action: "bug.status_change", entityId: { in: ids(movedEv) }, changes: toStatus("IN_PROGRESS") }, orderBy: { createdAt: "asc" }, select: { entityId: true, createdAt: true } }),
  ]);
  const firstStart = new Map<string, Date>();
  for (const s of started) if (s.entityId && !firstStart.has(s.entityId)) firstStart.set(s.entityId, s.createdAt);
  const movedAt = new Map<string, Date>();
  for (const e of movedEv) if (e.entityId && !movedAt.has(e.entityId)) movedAt.set(e.entityId, e.createdAt);
  const now = new Date();
  const [docsDecided, sprintsClosed, draftsWaiting] = await Promise.all([
    prisma.businessDocVersion.findMany({ where: { decidedById: userId, decidedAt: range, doc: { projectId } }, select: { uploadedAt: true, decidedAt: true } }),
    prisma.sprintClosure.findMany({ where: { closedById: userId, createdAt: range, sprint: { projectId } }, select: { createdAt: true, sprint: { select: { endsAt: true } } } }),
    prisma.bug.count({ where: { projectId, status: "DRAFT", createdAt: { lt: new Date(+now - 2 * 86_400_000) } } }),
  ]);
  return {
    admin: adminMetrics({
      docs: docsDecided.filter((d): d is { uploadedAt: Date; decidedAt: Date } => !!d.decidedAt),
      sprints: sprintsClosed.map((s) => ({ closedAt: s.createdAt, endsAt: s.sprint.endsAt })),
      draftsWaiting,
    }),
    qa: qaMetrics({
      casesCreated: versions.filter((v) => v.version === 1).length, newVersions: versions.filter((v) => v.version > 1).length,
      attempts: attempts, reported, closedBugs,
      triaged: triaged.filter((t): t is { createdAt: Date; reviewedAt: Date } => !!t.reviewedAt),
    }),
    dev: devMetrics({
      moved: movedBugs.map((b) => ({ severity: b.severity, at: movedAt.get(b.id)!, dueAt: b.dueAt, fixedInBuild: b.fixedInBuild, reopenCount: b.reopenCount, startedAt: firstStart.get(b.id) ?? null, closed: b.status === "CLOSED" })),
      active: active.map((a) => ({ overdue: !!a.dueAt && a.dueAt < now })),
    }),
  };
}
