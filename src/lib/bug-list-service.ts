import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { activeModules } from "./modules";
import { listSavedViews } from "./saved-view-service";
import { listProjectTags } from "./bug-tag-service";
import { loadBoard } from "./bug-board-service";
import { startOfTodayWib } from "./triage-service";
import { bugOrderBy, bugTabWhere, buildBugWhere, pageWindow, type BugListFilters } from "./bug-list-query";

const ROW_INCLUDE = {
  assignee: { select: { name: true, email: true } },
  module: { select: { name: true } },
  sprint: { select: { name: true } },
  tags: { select: { name: true }, orderBy: { name: "asc" } },
  _count: { select: { comments: true, attachments: true, testRunLinks: true } },
} satisfies Prisma.BugInclude;

export type BugListRow = Prisma.BugGetPayload<{ include: typeof ROW_INCLUDE }>;
export type BugListData = Awaited<ReturnType<typeof loadBugListData>>;

type Ctx = { projectId: string; userId: string; canReview: boolean; filters: BugListFilters };

// Everything the bug list page shows, loaded in parallel. The page never touches Prisma itself.
export async function loadBugListData({ projectId, userId, canReview, filters }: Ctx) {
  const base: Prisma.BugWhereInput = { projectId };
  const where = buildBugWhere(filters, { projectId, userId });
  const isBoard = filters.layout === "board";
  const today = startOfTodayWib();

  const total = await prisma.bug.count({ where });
  const win = pageWindow(filters.page, total);

  const [
    reviewCount, mineCount, modules, members, sprints, savedViews, tags, reviewedToday, closedToday, bugs, boardColumns,
  ] = await Promise.all([
    prisma.bug.count({ where: { ...base, status: "DRAFT" } }),
    prisma.bug.count({ where: { ...base, ...bugTabWhere("mine", userId) } }),
    activeModules(projectId),
    prisma.projectMember.findMany({ where: { projectId }, include: { user: { select: { name: true, email: true } } } }),
    prisma.sprint.findMany({ where: { projectId }, orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
    listSavedViews(projectId, userId),
    listProjectTags(projectId),
    canReview ? prisma.bug.count({ where: { ...base, reviewedAt: { gte: today } } }) : 0,
    canReview
      ? prisma.auditLog.count({ where: { projectId, action: "bug.status_change", createdAt: { gte: today }, changes: { path: ["after", "status"], equals: "CLOSED" } } })
      : 0,
    isBoard
      ? Promise.resolve([] as BugListRow[])
      : prisma.bug.findMany({ where, orderBy: bugOrderBy(filters.view), skip: win.skip, take: win.take, include: ROW_INCLUDE }),
    isBoard ? loadBoard(where, filters.cols) : Promise.resolve([]),
  ]);

  return { total, win, reviewCount, mineCount, modules, members, sprints, savedViews, tags, reviewedToday, closedToday, bugs, boardColumns };
}
