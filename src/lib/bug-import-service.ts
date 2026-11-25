import { BugStatus } from "@prisma/client";
import { prisma } from "./db";
import { activeModules } from "./modules";
import { parseMarkdownBugs } from "./markdown-importer";

export type ImportPreviewRow = { title: string; severity: string; module: string; status: "Siap" | "Mirip"; note: string };
export type ImportPreviewResult = { error: string } | { rows: ImportPreviewRow[] };

const NO_FILE = "Pilih file Markdown (.md).";
const NO_ROWS = "Tidak ada bug yang terbaca. Cek format tabel / heading file Markdown.";

// Dry run: parse the file and flag rows that look like existing bugs. Writes nothing.
export async function previewBugImport(projectId: string, markdown: string): Promise<ImportPreviewResult> {
  if (!markdown.trim()) return { error: NO_FILE };
  const parsed = parseMarkdownBugs(markdown);
  if (parsed.length === 0) return { error: NO_ROWS };
  const [mods, existing] = await Promise.all([
    activeModules(projectId),
    prisma.bug.findMany({ where: { projectId }, select: { key: true, title: true } }),
  ]);
  const modNames = new Set(mods.map((m) => m.name.toLowerCase()));
  return {
    rows: parsed.map((b) => {
      const area = b.moduleArea?.trim() ?? "";
      const dup = existing.find((e) => e.title.trim().toLowerCase() === b.title.trim().toLowerCase());
      const noModule = area && !modNames.has(area.toLowerCase());
      return {
        title: b.title,
        severity: b.severity,
        module: area || "—",
        status: dup ? "Mirip" : "Siap",
        note: dup ? `Mirip ${dup.key}` : noModule ? "Modul tidak ditemukan, masuk tanpa modul" : "",
      };
    }),
  };
}

// Creates every row as a Draft in one transaction. Numbers come from project.bugSeq, the same counter the report form uses.
export async function importBugs(reporterId: string, projectId: string, projectKey: string, markdown: string) {
  if (!markdown.trim()) return { error: NO_FILE };
  const parsed = parseMarkdownBugs(markdown);
  if (parsed.length === 0) return { error: NO_ROWS };

  const byName = new Map((await activeModules(projectId)).map((m) => [m.name.toLowerCase(), m.id]));
  await prisma.$transaction(async (tx) => {
    for (const b of parsed) {
      const area = b.moduleArea?.trim();
      const { bugSeq: number } = await tx.project.update({ where: { id: projectId }, data: { bugSeq: { increment: 1 } }, select: { bugSeq: true } });
      await tx.bug.create({
        data: {
          projectId,
          key: `${projectKey}-${number}`,
          number,
          title: b.title.slice(0, 200),
          severity: b.severity,
          status: BugStatus.DRAFT,
          reporterId,
          moduleId: area ? byName.get(area.toLowerCase()) ?? null : null,
          stepsToReproduce: b.stepsToReproduce || "-",
          actualResult: b.actualResult || "-",
          expectedResult: b.expectedResult || "-",
        },
      });
    }
  });
  return { ok: `Berhasil mengimpor ${parsed.length} bug sebagai Draft.` };
}
