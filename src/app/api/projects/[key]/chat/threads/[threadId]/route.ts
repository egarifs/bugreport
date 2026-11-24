import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string; threadId: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, threadId } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  if (!project.members[0] && !user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, projectId: project.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!thread) return NextResponse.json({ error: "Thread tidak ditemukan" }, { status: 404 });

  const messages = await prisma.chatMessage.findMany({
    where: { projectId: project.id, threadId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    take: 100,
  });

  return NextResponse.json({ thread, messages });
}
