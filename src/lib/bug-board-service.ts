import type { BugSeverity, BugStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { BOARD_COLUMNS } from "./bug-board";

export type BoardCard = {
  id: string; key: string; number: number; title: string;
  severity: BugSeverity; status: BugStatus; createdAt: string;
  moduleName: string | null; assigneeName: string | null; sprintName: string | null;
  comments: number; attachments: number; tags: string[];
};
export type BoardColumnData = { id: string; label: string; count: number; cards: BoardCard[] };

// One query pair per column: total for the header, first `limit` cards for the body.
// `where` already carries project scope and filters (see buildBugWhere).
export async function loadBoard(where: Prisma.BugWhereInput, limit: number): Promise<BoardColumnData[]> {
  return Promise.all(
    BOARD_COLUMNS.map(async (col) => {
      const colWhere: Prisma.BugWhereInput = { AND: [where, { status: { in: col.statuses } }] };
      const [count, bugs] = await Promise.all([
        prisma.bug.count({ where: colWhere }),
        prisma.bug.findMany({
          where: colWhere,
          orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
          take: limit,
          select: {
            id: true, key: true, number: true, title: true, severity: true, status: true, createdAt: true,
            module: { select: { name: true } },
            assignee: { select: { name: true, email: true } },
            sprint: { select: { name: true } },
            tags: { select: { name: true }, orderBy: { name: "asc" } },
            _count: { select: { comments: true, attachments: true } },
          },
        }),
      ]);
      return {
        id: col.id,
        label: col.label,
        count,
        cards: bugs.map((b) => ({
          id: b.id, key: b.key, number: b.number, title: b.title, severity: b.severity, status: b.status,
          createdAt: b.createdAt.toISOString(),
          moduleName: b.module?.name ?? null,
          assigneeName: b.assignee ? b.assignee.name || b.assignee.email : null,
          sprintName: b.sprint?.name ?? null,
          comments: b._count.comments, attachments: b._count.attachments, tags: b.tags.map((t) => t.name),
        })),
      };
    }),
  );
}
