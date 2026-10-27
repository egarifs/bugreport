import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exportBugsCsv } from "@/lib/report";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.members[0] && !user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const csv = await exportBugsCsv(project.id);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.key}-bugs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
