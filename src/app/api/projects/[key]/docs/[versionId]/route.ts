import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { docFilePath, isMarkdown } from "@/lib/business-docs";

// Raw file for PDF iframe / download. ?download=1 forces attachment.
export async function GET(req: Request, { params }: { params: Promise<{ key: string; versionId: string }> }) {
  const userId = (await auth())?.user?.id;
  const { key, versionId } = await params;
  const v = await prisma.businessDocVersion.findUnique({
    where: { id: versionId },
    include: { doc: { select: { projectId: true, project: { select: { key: true } } } } },
  });
  if (!v || v.doc.project.key !== key.toUpperCase()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await checkProjectPermission(userId, v.doc.projectId, "doc.read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const bytes = await fs.readFile(docFilePath(v.doc.project.key, v.storedPath)).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "File hilang" }, { status: 404 });
  // Type from extension (validated on upload), never from client-sent mimeType.
  const type = isMarkdown(v.fileName) ? "text/markdown; charset=utf-8" : "application/pdf";
  const download = new URL(req.url).searchParams.has("download") || isMarkdown(v.fileName);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      // No CSP sandbox: Chrome refuses to render PDFs in sandboxed frames.
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(v.fileName)}`,
    },
  });
}
