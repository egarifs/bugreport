import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import { notifyBug } from "./notify";
import { recordAuditLog } from "@/lib/user-service";
import { activeModules, resolveModuleId } from "@/lib/modules";
import { BugPriority, BugSeverity, ProjectRole, TestCasePriority } from "@prisma/client";
import { readDocText } from "./business-docs";
import fs from "node:fs/promises";
import path from "node:path";

export interface McpContext {
  projectId: string;
  projectKey: string;
  apiKeyId: string;
  actorEmail: string;
  actorId: string;
  role: ProjectRole;
}

export const MCP_TOOLS_DEFINITIONS = [
  {
    name: "list_modules",
    description: "Daftar modul aplikasi aktif di project ini. Pakai nama persis untuk field component di create_bug_draft.",
    inputSchema: { type: "object", properties: {} },
  },
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
        component: { type: "string", description: "Nama modul dari list_modules. Nama tak dikenal dikosongkan; QA isi saat review." },
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
  {
    name: "search_test_cases",
    description: "Cari daftar test cases dalam project berdasarkan query teks judul atau modul.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Kata kunci pencarian judul atau prasyarat" },
        module: { type: "string", description: "Filter nama modul" },
        priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
        limit: { type: "number", description: "Batas jumlah data (default: 20, max: 100)" },
      },
    },
  },
  {
    name: "get_test_case",
    description: "Ambil detail lengkap satu test case berdasarkan kode (misal: TC-AUTH-001).",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Kode test case" },
      },
      required: ["code"],
    },
  },
  {
    name: "list_business_docs",
    description: "Daftar dokumen bisnis/PRD aktif dalam project.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "read_business_doc",
    description: "Baca isi teks lengkap dokumen bisnis (Markdown/PRD) versi aktif berdasarkan slug dokumen.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug dokumen (misal: prd, user-flow)" },
      },
      required: ["slug"],
    },
  },
  {
    name: "upload_business_doc",
    description: "Upload atau update dokumen bisnis Markdown/PRD baru (v+1) dalam project. Khusus role QA.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul dokumen bisnis" },
        slug: { type: "string", description: "Slug dokumen unik (misal: prd-checkout)" },
        description: { type: "string", description: "Deskripsi singkat dokumen" },
        contentMarkdown: { type: "string", description: "Isi lengkap dokumen dalam format Markdown" },
      },
      required: ["title", "slug", "contentMarkdown"],
    },
  },
  {
    name: "create_test_cases",
    description: "Buat atau update test cases dalam batch (atau single) dari hasil analisa dokumen PRD/Figma. Jika code sudah ada, otomatis update (upsert).",
    inputSchema: {
      type: "object",
      properties: {
        testCases: {
          type: "array",
          description: "Daftar test case yang akan dibuat/diupdate.",
          items: {
            type: "object",
            properties: {
              code: { type: "string", description: "Kode unik test case (opsional, misal: TC-AUTH-001). Jika kosong, digenerate otomatis." },
              title: { type: "string", description: "Judul skenario pengujian" },
              module: { type: "string", description: "Nama modul terkait (opsional)" },
              priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"], description: "Prioritas pengujian (default: MEDIUM)" },
              testType: { type: "string", description: "Tipe pengujian, misal: Functional, Negative, UI, Security" },
              targetRole: { type: "string", description: "Aktor/role yang menjalankan, misal: Admin, Dokter, Pasien" },
              precondition: { type: "string", description: "Prasyarat sebelum skenario dijalankan" },
              steps: { type: "string", description: "Langkah-langkah pengujian terurut" },
              expectedResult: { type: "string", description: "Hasil yang diharapkan" },
              referenceUrl: { type: "string", description: "Tautan referensi Figma, Notion, atau PRD" },
            },
            required: ["title", "steps", "expectedResult"],
          },
        },
      },
      required: ["testCases"],
    },
  },
];

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: McpContext
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
  const qaOnlyTools = ["create_bug_draft", "attach_bug_screenshot", "create_test_cases", "upload_business_doc"];
  if (qaOnlyTools.includes(toolName) && ctx.role !== "QA" && ctx.role !== "ADMIN") {
    return {
      content: [
        {
          type: "text",
          text: `Akses ditolak: Tool '${toolName}' hanya dapat dijalankan oleh agent dengan role QA. Role key Anda: ${ctx.role}. Non-QA hanya memiliki akses view & comment.`,
        },
      ],
      isError: true,
    };
  }
    switch (toolName) {
      case "list_modules": {
        const mods = await activeModules(ctx.projectId);
        return { content: [{ type: "text", text: JSON.stringify(mods.map((m) => m.name)) }] };
      }

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
        const moduleId = await resolveModuleId(ctx.projectId, component);
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
              moduleId,
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
        await notifyBug(createdBug.id, { id: ctx.actorId, name: `Agent (${ctx.actorEmail})` }, { kind: "draft", source: "mcp" });

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
        await notifyBug(bug.id, { id: ctx.actorId, name: `Agent (${ctx.actorEmail})` }, { kind: "comment", commentType: "PUBLIC", excerpt: body });

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

      case "create_test_cases": {
        const rawItems = Array.isArray(args.testCases) ? args.testCases : [];
        if (!rawItems.length) {
          return { content: [{ type: "text", text: "Array 'testCases' tidak boleh kosong." }], isError: true };
        }

        const results: Array<{ code: string; title: string; action: "CREATED" | "UPDATED" }> = [];

        // Count existing test cases to generate sequence if code is omitted
        let tcCount = await prisma.testCase.count({ where: { projectId: ctx.projectId } });

        for (const item of rawItems) {
          const title = redactSecrets(String(item.title || "").trim());
          const steps = redactSecrets(String(item.steps || "").trim());
          const expectedResult = redactSecrets(String(item.expectedResult || "").trim());
          if (!title || !steps || !expectedResult) continue;

          let code = String(item.code || "").trim().toUpperCase();
          if (!code) {
            tcCount += 1;
            const prefix = item.module ? String(item.module).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) : ctx.projectKey;
            code = `TC-${prefix || "GEN"}-${String(tcCount).padStart(3, "0")}`;
          }

          const moduleId = await resolveModuleId(ctx.projectId, item.module);
          const priority = (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(item.priority)
            ? item.priority
            : "MEDIUM") as TestCasePriority;

          const data = {
            title,
            steps,
            expectedResult,
            moduleArea: item.module ? String(item.module).trim() : null,
            moduleId,
            priority,
            testType: item.testType ? String(item.testType).trim() : null,
            targetRole: item.targetRole ? String(item.targetRole).trim() : null,
            precondition: item.precondition ? redactSecrets(String(item.precondition).trim()) : null,
            referenceUrl: item.referenceUrl ? String(item.referenceUrl).trim() : null,
          };

          const existing = await prisma.testCase.findUnique({
            where: { projectId_code: { projectId: ctx.projectId, code } },
          });

          if (existing) {
            await prisma.testCase.update({
              where: { id: existing.id },
              data,
            });
            results.push({ code, title, action: "UPDATED" });
          } else {
            await prisma.testCase.create({
              data: {
                projectId: ctx.projectId,
                code,
                ...data,
              },
            });
            results.push({ code, title, action: "CREATED" });
          }
        }

        await recordAuditLog({
          projectId: ctx.projectId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          actorType: "agent",
          action: "testcase.manage",
          entityType: "testcase",
          entityId: ctx.projectId,
          changes: { after: { totalProcessed: results.length, summary: results } },
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ status: "SUCCESS", count: results.length, items: results }) }],
        };
      }

      case "search_test_cases": {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        const modName = typeof args.module === "string" ? args.module.trim() : "";
        const priority = typeof args.priority === "string" ? (args.priority as TestCasePriority) : undefined;
        const limit = Math.min(100, Math.max(1, Number(args.limit) || 20));

        const where: Record<string, unknown> = { projectId: ctx.projectId };
        if (priority) where.priority = priority;
        if (query) {
          where.OR = [
            { title: { contains: query, mode: "insensitive" } },
            { steps: { contains: query, mode: "insensitive" } },
          ];
        }
        if (modName) {
          const modId = await resolveModuleId(ctx.projectId, modName);
          where.OR = [
            ...(Array.isArray(where.OR) ? where.OR : []),
            { moduleArea: { equals: modName, mode: "insensitive" } },
            ...(modId ? [{ moduleId: modId }] : []),
          ];
        }

        const cases = await prisma.testCase.findMany({
          where,
          take: limit,
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            title: true,
            priority: true,
            testType: true,
            moduleArea: true,
            module: { select: { name: true } },
            referenceUrl: true,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                cases.map((c) => ({
                  id: c.id,
                  code: c.code,
                  title: c.title,
                  priority: c.priority,
                  testType: c.testType,
                  module: c.module?.name || c.moduleArea || null,
                  referenceUrl: c.referenceUrl,
                }))
              ),
            },
          ],
        };
      }

      case "get_test_case": {
        const code = String(args.code || "").trim().toUpperCase();
        if (!code) {
          return { content: [{ type: "text", text: "Parameter 'code' wajib diisi." }], isError: true };
        }

        const tc = await prisma.testCase.findUnique({
          where: { projectId_code: { projectId: ctx.projectId, code } },
          include: { module: { select: { name: true } } },
        });

        if (!tc) {
          return { content: [{ type: "text", text: `Test case '${code}' tidak ditemukan.` }], isError: true };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                code: tc.code,
                title: tc.title,
                priority: tc.priority,
                testType: tc.testType,
                targetRole: tc.targetRole,
                precondition: tc.precondition,
                steps: tc.steps,
                expectedResult: tc.expectedResult,
                referenceUrl: tc.referenceUrl,
                module: tc.module?.name || tc.moduleArea,
              }),
            },
          ],
        };
      }

      case "list_business_docs": {
        const docs = await prisma.businessDoc.findMany({
          where: { projectId: ctx.projectId },
          include: {
            versions: {
              where: { isCurrent: true },
              select: { versionNum: true, fileName: true, fileSize: true, uploadedAt: true },
            },
          },
          orderBy: { title: "asc" },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                docs.map((d) => ({
                  title: d.title,
                  slug: d.slug,
                  description: d.description,
                  currentVersion: d.versions[0]?.versionNum || null,
                  fileName: d.versions[0]?.fileName || null,
                  fileSize: d.versions[0]?.fileSize || null,
                  updatedAt: d.versions[0]?.uploadedAt || d.updatedAt,
                }))
              ),
            },
          ],
        };
      }

      case "read_business_doc": {
        const slug = String(args.slug || "").trim().toLowerCase();
        if (!slug) {
          return { content: [{ type: "text", text: "Parameter 'slug' wajib diisi." }], isError: true };
        }

        const doc = await prisma.businessDoc.findUnique({
          where: { projectId_slug: { projectId: ctx.projectId, slug } },
          include: {
            versions: {
              where: { isCurrent: true },
              select: { storedPath: true, fileName: true, versionNum: true },
            },
          },
        });

        if (!doc) {
          return { content: [{ type: "text", text: `Dokumen dengan slug '${slug}' tidak ditemukan.` }], isError: true };
        }

        const currVer = doc.versions[0];
        if (!currVer) {
          return { content: [{ type: "text", text: `Dokumen '${doc.title}' belum memiliki versi aktif.` }], isError: true };
        }

        const textContent = await readDocText(ctx.projectKey, currVer);
        if (textContent === null) {
          return {
            content: [
              {
                type: "text",
                text: `File versi aktif '${currVer.fileName}' bukan file Markdown atau tidak dapat dibaca langsung sebagai teks.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: doc.title,
                slug: doc.slug,
                version: currVer.versionNum,
                fileName: currVer.fileName,
                content: textContent,
              }),
            },
          ],
        };
      }

      case "upload_business_doc": {
        const title = redactSecrets(String(args.title || "").trim());
        const rawSlug = String(args.slug || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        const description = args.description ? redactSecrets(String(args.description).trim()) : null;
        const content = redactSecrets(String(args.contentMarkdown || "").trim());

        if (!title || !rawSlug || !content) {
          return {
            content: [{ type: "text", text: "Parameter 'title', 'slug', dan 'contentMarkdown' wajib diisi." }],
            isError: true,
          };
        }

        const fileName = `${rawSlug}.md`;
        const uploadDir = path.join(process.cwd(), "uploads", ctx.projectKey, "docs");
        await fs.mkdir(uploadDir, { recursive: true });

        const storedName = `${Date.now()}_${fileName}`;
        const storedPath = path.join(uploadDir, storedName);
        await fs.writeFile(storedPath, content, "utf8");

        const resultDoc = await prisma.$transaction(async (tx) => {
          let doc = await tx.businessDoc.findUnique({
            where: { projectId_slug: { projectId: ctx.projectId, slug: rawSlug } },
            include: { versions: { orderBy: { versionNum: "desc" }, take: 1 } },
          });

          let nextVersion = 1;
          if (doc) {
            nextVersion = (doc.versions[0]?.versionNum || 0) + 1;
            await tx.businessDocVersion.updateMany({
              where: { docId: doc.id },
              data: { isCurrent: false },
            });
            await tx.businessDoc.update({
              where: { id: doc.id },
              data: { title, description: description ?? doc.description },
            });
          } else {
            doc = await tx.businessDoc.create({
              data: {
                projectId: ctx.projectId,
                title,
                slug: rawSlug,
                description,
              },
              include: { versions: true },
            });
          }

          const version = await tx.businessDocVersion.create({
            data: {
              docId: doc.id,
              versionNum: nextVersion,
              fileName,
              storedPath,
              fileSize: Buffer.byteLength(content, "utf8"),
              mimeType: "text/markdown",
              isCurrent: true,
              uploadedById: ctx.actorId,
            },
          });

          return { doc, version };
        });

        await recordAuditLog({
          projectId: ctx.projectId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          actorType: "agent",
          action: "doc.manage",
          entityType: "business_doc",
          entityId: resultDoc.doc.id,
          changes: { after: { slug: rawSlug, version: resultDoc.version.versionNum, title } },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "SUCCESS",
                docId: resultDoc.doc.id,
                slug: rawSlug,
                version: resultDoc.version.versionNum,
                title,
              }),
            },
          ],
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
