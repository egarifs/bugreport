import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";

// GET screenshot bytes; same membership check as the bug page.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string; id: string }> }) {
  const userId = (await auth())?.user?.id;
  const { key, id } = await params;
  const att = await prisma.bugAttachment.findUnique({
    where: { id },
    include: { bug: { select: { projectId: true, project: { select: { key: true } } } } },
  });
  if (!att || att.bug.project.key !== key.toUpperCase()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await checkProjectPermission(userId, att.bug.projectId, "project.read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const file = path.join(process.cwd(), "uploads", att.bug.project.key, "attachments", path.basename(att.storedName));
  const bytes = await fs.readFile(file).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "File hilang" }, { status: 404 });
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": att.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName)}"`,
    },
  });
}
