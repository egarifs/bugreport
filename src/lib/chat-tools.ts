import { prisma } from "./db";
import { hasPermission } from "./permissions";
import { ProjectRole } from "@prisma/client";

export interface ChatUserContext {
  userId: string;
  projectId: string;
  role: ProjectRole;
  isAdmin: boolean;
}

export const CLAUDE_CHAT_TOOLS = [
  {
    name: "list_bugs",
    description: "Ambil daftar bug di project ini dengan filter status atau severity.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter: DRAFT, OPEN, IN_PROGRESS, READY_FOR_VERIFICATION, CLOSED" },
        severity: { type: "string", description: "Filter: BLOCKER, HIGH, MEDIUM, LOW" },
        limit: { type: "number", description: "Maksimal bug diambil (default 10, max 25)" },
      },
    },
  },
  {
    name: "get_bug",
    description: "Ambil detail lengkap bug berdasarkan ID key (misal: CRM-1). Hanya mengembalikan internal note jika user berhak.",
    input_schema: {
      type: "object" as const,
      properties: {
        bugKey: { type: "string", description: "Key unik bug, misal: CRM-1" },
      },
      required: ["bugKey"],
    },
  },
  {
    name: "bug_stats",
    description: "Ambil ringkasan statistik kesehatan bug project (jumlah status, blocker aktif, reopen count).",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "search_business_docs",
    description: "Cari potongan dokumen bisnis (PRD/BRD) yang relevan dengan pertanyaan menggunakan full-text query.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Kata kunci requirement / fitur / modul" },
      },
      required: ["query"],
    },
  },
];

export async function executeChatTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ChatUserContext
): Promise<string> {
  const canSeeInternal = hasPermission(ctx.role, "note.internal.read", ctx.isAdmin);

  switch (toolName) {
    case "list_bugs": {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
      const bugs = await prisma.bug.findMany({
        where: {
          projectId: ctx.projectId,
          ...(args.status ? { status: String(args.status) as never } : {}),
          ...(args.severity ? { severity: String(args.severity) as never } : {}),
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          key: true,
          title: true,
          status: true,
          severity: true,
          priority: true,
          environment: true,
          assignee: { select: { name: true, email: true } },
        },
      });
      return JSON.stringify({ count: bugs.length, bugs });
    }

    case "get_bug": {
      const bugKey = String(args.bugKey || "").trim();
      const bug = await prisma.bug.findFirst({
        where: {
          projectId: ctx.projectId,
          key: bugKey.toUpperCase(),
        },
        include: {
          reporter: { select: { name: true, email: true } },
          assignee: { select: { name: true, email: true } },
          comments: {
            where: {
              ...(canSeeInternal ? {} : { type: "PUBLIC" }),
            },
            select: {
              author: { select: { name: true, email: true } },
              body: true,
              type: true,
              createdAt: true,
            },
          },
        },
      });

      if (!bug) return JSON.stringify({ error: `Bug ${bugKey} tidak ditemukan.` });
      return JSON.stringify(bug);
    }

    case "bug_stats": {
      const [total, draft, open, inProgress, needVerify, closed, reopened, blockers] = await Promise.all([
        prisma.bug.count({ where: { projectId: ctx.projectId } }),
        prisma.bug.count({ where: { projectId: ctx.projectId, status: "DRAFT" } }),
        prisma.bug.count({ where: { projectId: ctx.projectId, status: "OPEN" } }),
        prisma.bug.count({ where: { projectId: ctx.projectId, status: "IN_PROGRESS" } }),
        prisma.bug.count({ where: { projectId: ctx.projectId, status: "READY_FOR_VERIFICATION" } }),
        prisma.bug.count({ where: { projectId: ctx.projectId, status: "CLOSED" } }),
        prisma.bug.count({ where: { projectId: ctx.projectId, status: "REOPENED" } }),
        prisma.bug.count({
          where: {
            projectId: ctx.projectId,
            severity: "BLOCKER",
            status: { notIn: ["CLOSED", "INVALID", "WONT_FIX"] },
          },
        }),
      ]);

      return JSON.stringify({
        total,
        draft,
        open,
        inProgress,
        needVerify,
        closed,
        reopened,
        activeBlockers: blockers,
        releaseReady: blockers === 0 && open === 0,
      });
    }

    case "search_business_docs": {
      const q = String(args.query || "").trim();
      if (!q) return JSON.stringify({ results: [] });

      const docs = await prisma.businessDoc.findMany({
        where: {
          projectId: ctx.projectId,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          versions: {
            where: { isCurrent: true },
            select: { versionNum: true, fileName: true },
          },
        },
        take: 5,
      });

      return JSON.stringify({
        query: q,
        foundDocs: docs.map((d) => ({
          title: d.title,
          currentVersion: `v${d.versions[0]?.versionNum ?? 1}`,
          description: d.description,
          file: d.versions[0]?.fileName,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
