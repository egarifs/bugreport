import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/projects/:key/duplicates?q=title_text
export async function GET(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.email || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!user.isAdmin && project.members.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 3) {
    return NextResponse.json({ duplicates: [] });
  }

  // Native pg_trgm similarity check (similarity > 0.4) on active bugs in same project
  // Excludes CLOSED and CANNOT_REPRODUCE/INVALID if applicable
  const duplicates = await prisma.$queryRaw<
    Array<{
      id: string;
      key: string;
      number: number;
      title: string;
      status: string;
      severity: string;
      similarity: number;
    }>
  >`
    SELECT 
      id,
      key,
      number,
      title,
      status,
      severity,
      similarity(title, ${q}) as similarity
    FROM "Bug"
    WHERE "projectId" = ${project.id}
      AND status NOT IN ('CLOSED')
      AND similarity(title, ${q}) > 0.35
    ORDER BY similarity DESC
    LIMIT 5;
  `;

  return NextResponse.json({ duplicates });
}
