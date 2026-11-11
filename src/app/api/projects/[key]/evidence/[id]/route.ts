import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { evidencePath } from "@/lib/agent-service";

// GET evidence file; same membership check as the test run page.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string; id: string }> }) {
  const userId = (await auth())?.user?.id;
  const { key, id } = await params;
  const ev = await prisma.evidence.findUnique({ where: { id }, include: { project: { select: { key: true } } } });
  if (!ev || ev.project.key !== key.toUpperCase()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await checkProjectPermission(userId, ev.projectId, "project.read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ev.purgedAt) return NextResponse.json({ error: "File dihapus karena item Lolos" }, { status: 410 });
  const bytes = await fs.readFile(evidencePath(ev.project.key, ev.storedName)).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "File hilang" }, { status: 404 });
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": ev.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${encodeURIComponent(ev.fileName)}"`,
    },
  });
}
