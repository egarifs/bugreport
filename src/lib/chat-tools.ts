import { prisma } from "./db";
import { hasPermission } from "./permissions";
import { ProjectRole } from "@prisma/client";
import { rankSections, readDocText, splitSections } from "./business-docs";

const DOC_READ_MAX = 40_000; // ~10k tokens per doc read

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
    description: "Cari di ISI dokumen bisnis (PRD/BRD) versi aktif. Mengembalikan daftar dokumen dan potongan bagian paling relevan (judul bagian + teks).",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Kata kunci requirement / fitur / modul / aturan bisnis" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_business_doc",
    description: "Baca isi lengkap satu dokumen bisnis versi aktif (Markdown). Pakai untuk ringkasan atau pertanyaan umum tentang dokumen. Teks panjang dipotong.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Judul dokumen persis dari search_business_docs" },
      },
      required: ["title"],
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
      const docs = await currentDocs(ctx.projectId);
      const ql = q.toLowerCase();
      const results = await Promise.all(
        docs.map(async (d) => {
          const text = await readDocText(d.projectKey, d.version);
          const sections = text ? splitSections(text) : [];
          const titleHit = ql.split(/\s+/).some((t) => t.length > 1 && `${d.title} ${d.description ?? ""}`.toLowerCase().includes(t));
          const top = rankSections(sections, q, 4);
          return {
            title: d.title,
            currentVersion: `v${d.version.versionNum}`,
            description: d.description,
            file: d.version.fileName,
            contentReadable: text !== null,
            outline: titleHit ? sections.map((s) => s.heading).filter((h, i, a) => a.indexOf(h) === i).slice(0, 40) : undefined,
            matches: top.map((s) => ({ section: s.heading, text: s.text.slice(0, 1500) })),
            relevant: titleHit || top.length > 0,
          };
        })
      );
      return JSON.stringify({
        query: q,
        foundDocs: results.filter((r) => r.relevant).map((r) => ({ ...r, relevant: undefined })),
        hint: "Pakai read_business_doc untuk isi lengkap. PDF belum bisa dibaca isinya (contentReadable=false).",
      });
    }

    case "read_business_doc": {
      const title = String(args.title || "").trim().toLowerCase();
      const d = (await currentDocs(ctx.projectId)).find((x) => x.title.toLowerCase() === title);
      if (!d) return JSON.stringify({ error: "Dokumen tidak ditemukan. Cek judul lewat search_business_docs." });
      const text = await readDocText(d.projectKey, d.version);
      if (text === null) return JSON.stringify({ title: d.title, error: "Isi file belum bisa dibaca (PDF atau file hilang)." });
      return JSON.stringify({
        title: d.title,
        version: `v${d.version.versionNum}`,
        truncated: text.length > DOC_READ_MAX,
        content: text.slice(0, DOC_READ_MAX),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function currentDocs(projectId: string) {
  const docs = await prisma.businessDoc.findMany({
    where: { projectId },
    include: {
      project: { select: { key: true } },
      versions: { where: { isCurrent: true }, select: { versionNum: true, fileName: true, storedPath: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return docs
    .filter((d) => d.versions[0])
    .map((d) => ({ title: d.title, description: d.description, projectKey: d.project.key, version: d.versions[0] }));
}
