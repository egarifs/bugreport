import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import { recordAuditLog } from "@/lib/user-service";
import { BugPriority, BugSeverity } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

export interface McpContext {
  projectId: string;
  projectKey: string;
  apiKeyId: string;
  actorEmail: string;
  actorId: string;
}

export const MCP_TOOLS_DEFINITIONS = [
  {
    name: "search_bugs",
    description: "Cari daftar bug dalam project berdasarkan query teks atau filter status & severity.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Kata kunci pencarian judul atau deskripsi" },
        status: { type: "string", description: "Filter status: DRAFT, OPEN, IN_PROGRESS, READY_FOR_VERIFICATION, CLOSED" },
        severity: { type: "string", description: "Filter severity: BLOCKER, HIGH, MEDIUM, LOW" },
        limit: { type: "number", description: "Jumlah hasil maksimal (default 10, max 50)" },
      },
    },
  },
  {
    name: "get_bug",
    description: "Ambil detail lengkap bug berdasarkan ID angka atau key (misal: CRM-12).",
    inputSchema: {
      type: "object",
      properties: {
        bugKey: { type: "string", description: "Format: KEY-NUMBER atau nomor integer" },
      },
      required: ["bugKey"],
    },
  },
  {
    name: "create_bug_draft",
    description: "Laporkan temuan bug baru dari automated agent. Status SELALU DRAFT. Otomatis cek kemiripan judul.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul bug yang jelas dan spesifik" },
        description: { type: "string", description: "Latar belakang masalah atau konteks" },
        stepsToReproduce: { type: "string", description: "Langkah-langkah reproduksi (step-by-step)" },
        expectedResult: { type: "string", description: "Hasil yang diharapkan sesuai spesifikasi" },
        actualResult: { type: "string", description: "Hasil aktual yang ditemukan saat pengujian" },
        severity: { type: "string", enum: ["BLOCKER", "HIGH", "MEDIUM", "LOW"], description: "Tingkat keparahan dampak bug" },
        priority: { type: "string", enum: ["URGENT", "HIGH", "NORMAL", "LOW"], description: "Prioritas penanganan bug" },
        environment: { type: "string", description: "Environment pengujian, misal: Staging, Production" },
        buildNumber: { type: "string", description: "Nomor build atau commit hash saat bug ditemukan" },
        component: { type: "string", description: "Area modul atau komponen aplikasi" },
        agentName: { type: "string", description: "Nama automated agent pelapor, misal: playwright-qa" },
        runId: { type: "string", description: "ID run pipeline pengujian CI/CD" },
        force: { type: "boolean", description: "Set true jika ingin tetap membuat bug meski terdeteksi duplikat mirip" },
      },
      required: ["title", "stepsToReproduce", "expectedResult", "actualResult", "environment"],
    },
  },
  {
    name: "add_bug_comment",
    description: "Tambahkan komentar atau hasil verifikasi agent ke bug yang sudah ada.",
    inputSchema: {
      type: "object",
      properties: {
        bugKey: { type: "string", description: "Key bug tujuan, misal: CRM-12" },
        body: { type: "string", description: "Isi komentar (catatan pengujian atau log)" },
      },
      required: ["bugKey", "body"],
    },
  },
  {
    name: "attach_bug_screenshot",
    description: "Upload bukti screenshot base64 untuk bug yang bersangkutan.",
    inputSchema: {
      type: "object",
      properties: {
        bugKey: { type: "string", description: "Key bug tujuan, misal: CRM-12" },
        fileName: { type: "string", description: "Nama file, misal: screenshot_fail.png" },
        imageBase64: { type: "string", description: "Base64 string gambar (JPEG / PNG / WEBP)" },
      },
      required: ["bugKey", "fileName", "imageBase64"],
    },
  },
];

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: McpContext
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    switch (toolName) {
      case "search_bugs": {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);

        const bugs = await prisma.bug.findMany({
          where: {
            projectId: ctx.projectId,
            ...(query
              ? {
                  OR: [
                    { title: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } },
                  ],
                }
              : {}),
            ...(args.status ? { status: String(args.status) as never } : {}),
            ...(args.severity ? { severity: String(args.severity) as never } : {}),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            key: true,
            number: true,
            title: true,
            status: true,
            severity: true,
            priority: true,
            environment: true,
            createdAt: true,
          },
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ count: bugs.length, bugs }, null, 2) }],
        };
      }

      case "get_bug": {
        const bugKey = String(args.bugKey || "").trim();
        const num = parseInt(bugKey.replace(/^[A-Za-z]+-/, ""), 10);

        const bug = await prisma.bug.findFirst({
          where: {
            projectId: ctx.projectId,
            OR: [
              { key: bugKey.toUpperCase() },
              ...(!isNaN(num) ? [{ number: num }] : []),
            ],
          },
          include: {
            reporter: { select: { name: true, email: true } },
            assignee: { select: { name: true, email: true } },
            comments: {
              where: { type: "PUBLIC" },
              select: { author: { select: { name: true, email: true } }, body: true, createdAt: true },
            },
            attachments: { select: { fileName: true, fileSize: true, mimeType: true } },
          },
        });

        if (!bug) {
          return { content: [{ type: "text", text: `Bug '${bugKey}' tidak ditemukan pada project ini.` }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(bug, null, 2) }],
        };
      }

      case "create_bug_draft": {
        const title = redactSecrets(String(args.title || "").trim());
        const description = redactSecrets(String(args.description || "").trim());
        const stepsToReproduce = redactSecrets(String(args.stepsToReproduce || "").trim());
        const expectedResult = redactSecrets(String(args.expectedResult || "").trim());
        const actualResult = redactSecrets(String(args.actualResult || "").trim());
        const environment = String(args.environment || "Staging").trim();
        const buildNumber = args.buildNumber ? String(args.buildNumber).trim() : null;
        const component = args.component ? String(args.component).trim() : null;
        const severity = (String(args.severity || "MEDIUM").toUpperCase()) as BugSeverity;
        const priority = (String(args.priority || "NORMAL").toUpperCase()) as BugPriority;
        const agentName = String(args.agentName || "mcp-agent");
        const runId = String(args.runId || `run_${Date.now()}`);
        const force = Boolean(args.force);

        if (!title || !stepsToReproduce || !expectedResult || !actualResult) {
          return {
            content: [{ type: "text", text: "Parameter wajib tidak lengkap (title, stepsToReproduce, expectedResult, actualResult)." }],
            isError: true,
          };
        }

        // 1. Trigram Duplicate Similarity check
        interface TrigramMatch {
          id: string;
          key: string;
          title: string;
          sim: number;
        }

        const matches = await prisma.$queryRaw<TrigramMatch[]>`
          SELECT id, key, title, similarity(title, ${title}) as sim
          FROM "Bug"
          WHERE "projectId" = ${ctx.projectId}
            AND similarity(title, ${title}) >= 0.60
            AND status NOT IN ('CLOSED', 'INVALID', 'WONT_FIX')
          ORDER BY sim DESC
          LIMIT 3;
        `;

        if (matches.length > 0 && !force) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "DUPLICATE_CANDIDATE_FOUND",
                    message: "Ditemukan bug aktif yang serupa (similarity >= 60%). Gunakan parameter 'force: true' jika yakin ini bug yang berbeda.",
                    similarBugs: matches,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: false,
          };
        }

        // 2. Track or upsert AgentRun
        const agentRun = await prisma.agentRun.upsert({
          where: {
            projectId_runId: {
              projectId: ctx.projectId,
              runId,
            },
          },
          create: {
            projectId: ctx.projectId,
            apiKeyId: ctx.apiKeyId,
            agentName,
            runId,
          },
          update: {
            agentName,
          },
        });

        // 3. Atomically increment sequence and create DRAFT bug
        const createdBug = await prisma.$transaction(async (tx) => {
          const project = await tx.project.update({
            where: { id: ctx.projectId },
            data: { bugSeq: { increment: 1 } },
            select: { bugSeq: true, key: true },
          });

          const seq = project.bugSeq;
          const bugKey = `${project.key}-${seq}`;

          return tx.bug.create({
            data: {
              projectId: ctx.projectId,
              number: seq,
              key: bugKey,
              title,
              description,
              stepsToReproduce,
              expectedResult,
              actualResult,
              severity: ["BLOCKER", "HIGH", "MEDIUM", "LOW"].includes(severity) ? severity : "MEDIUM",
              priority: ["URGENT", "HIGH", "NORMAL", "LOW"].includes(priority) ? priority : "NORMAL",
              status: "DRAFT", // Always draft for agent
              environment,
              buildNumber,
              component,
              reporterId: ctx.actorId,
              agentRunId: agentRun.id,
            },
          });
        });

        await recordAuditLog({
          projectId: ctx.projectId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          actorType: "agent",
          action: "bug.create_mcp",
          entityType: "bug",
          entityId: createdBug.id,
          changes: {
            after: {
              key: createdBug.key,
              title: createdBug.title,
              agentName,
              runId,
            },
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "CREATED",
                  bugKey: createdBug.key,
                  number: createdBug.number,
                  title: createdBug.title,
                  severity: createdBug.severity,
                  priority: createdBug.priority,
                  bugStatus: createdBug.status,
                  agentRunId: agentRun.id,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "add_bug_comment": {
        const bugKey = String(args.bugKey || "").trim();
        const body = redactSecrets(String(args.body || "").trim());

        if (!bugKey || !body) {
          return { content: [{ type: "text", text: "Parameter bugKey dan body wajib diisi." }], isError: true };
        }

        const bug = await prisma.bug.findFirst({
          where: { projectId: ctx.projectId, key: bugKey.toUpperCase() },
        });

        if (!bug) {
          return { content: [{ type: "text", text: `Bug '${bugKey}' tidak ditemukan.` }], isError: true };
        }

        const comment = await prisma.bugComment.create({
          data: {
            bugId: bug.id,
            authorId: ctx.actorId,
            body: `[Agent Comment]\n${body}`,
            type: "PUBLIC",
          },
        });

        await recordAuditLog({
          projectId: ctx.projectId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          actorType: "agent",
          action: "bug.comment_mcp",
          entityType: "bug_comment",
          entityId: comment.id,
          changes: { after: { bugKey: bug.key } },
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ status: "SUCCESS", commentId: comment.id, bugKey: bug.key }) }],
        };
      }

      case "attach_bug_screenshot": {
        const bugKey = String(args.bugKey || "").trim();
        const fileName = String(args.fileName || "screenshot.png").replace(/[^a-zA-Z0-9._-]/g, "_");
        const imageBase64 = String(args.imageBase64 || "");

        if (!bugKey || !imageBase64) {
          return { content: [{ type: "text", text: "Parameter bugKey dan imageBase64 wajib diisi." }], isError: true };
        }

        const bug = await prisma.bug.findFirst({
          where: { projectId: ctx.projectId, key: bugKey.toUpperCase() },
        });

        if (!bug) {
          return { content: [{ type: "text", text: `Bug '${bugKey}' tidak ditemukan.` }], isError: true };
        }

        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");

        if (buffer.length > 5 * 1024 * 1024) {
          return { content: [{ type: "text", text: "Ukuran screenshot melebihi batas 5 MB." }], isError: true };
        }

        const uploadDir = path.join(process.cwd(), "uploads", ctx.projectKey, "attachments");
        await fs.mkdir(uploadDir, { recursive: true });

        const storedName = `${Date.now()}_${fileName}`;
        const storedPath = path.join(uploadDir, storedName);
        await fs.writeFile(storedPath, buffer);

        const attachment = await prisma.bugAttachment.create({
          data: {
            bugId: bug.id,
            fileName,
            storedName,
            fileSize: buffer.length,
            mimeType: "image/png",
          },
        });

        await recordAuditLog({
          projectId: ctx.projectId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          actorType: "agent",
          action: "bug.attach_mcp",
          entityType: "bug_attachment",
          entityId: attachment.id,
          changes: { after: { bugKey: bug.key, fileName } },
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ status: "SUCCESS", attachmentId: attachment.id, fileName }) }],
        };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool '${toolName}'` }], isError: true };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error executing tool: ${msg}` }], isError: true };
  }
}
