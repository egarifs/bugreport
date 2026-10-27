import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectRole } from "@prisma/client";
import { askClaudeProjectChat } from "@/lib/claude-service";
import { ChatUserContext } from "@/lib/chat-tools";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  if (!project.members[0] && !user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: tidak ada akses ke project ini" }, { status: 403 });
  }

  const role: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  const content = (body.message || "").trim();
  if (!content) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }

  // Rate limiter: maks 30 pesan / user / jam di project ini
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const messageCount = await prisma.chatMessage.count({
    where: {
      projectId: project.id,
      userId: user.id,
      role: "USER",
      createdAt: { gte: oneHourAgo },
    },
  });

  if (messageCount >= 30) {
    return NextResponse.json(
      { error: "Batas chat per jam terlampaui (maksimal 30 pesan per jam per user)." },
      { status: 429 }
    );
  }

  // 1. Simpan pesan User
  await prisma.chatMessage.create({
    data: {
      projectId: project.id,
      userId: user.id,
      role: "USER",
      content,
    },
  });

  // 2. Ambil riwayat percakapan terkini (10 pesan terakhir)
  const history = await prisma.chatMessage.findMany({
    where: { projectId: project.id, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const formattedHistory = history.reverse().map((m) => ({
    role: m.role.toLowerCase() as "user" | "assistant",
    content: m.content,
  }));

  const ctx: ChatUserContext = {
    userId: user.id,
    projectId: project.id,
    role,
    isAdmin: Boolean(user.isAdmin),
  };

  try {
    const { reply, inputTokens, outputTokens } = await askClaudeProjectChat(
      formattedHistory,
      ctx
    );

    // 3. Simpan pesan Assistant
    const savedAssistantMessage = await prisma.chatMessage.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: "ASSISTANT",
        content: reply,
        tokenUsage: { inputTokens, outputTokens },
      },
    });

    return NextResponse.json({
      success: true,
      message: savedAssistantMessage,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Gagal memproses chat AI: ${errorMsg}` },
      { status: 500 }
    );
  }
}
