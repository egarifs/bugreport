import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectRole } from "@prisma/client";
import { askClaudeProjectChat } from "@/lib/claude-service";
import { ChatUserContext } from "@/lib/chat-tools";
import { CHAT_MESSAGE_MAX, dailyTokenQuota, projectTokensToday } from "@/lib/chat-quota";

export async function GET(
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

  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  if (!project.members[0] && !user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const threads = await prisma.chatThread.findMany({
    where: { projectId: project.id },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
    take: 50,
  });

  return NextResponse.json({ threads });
}

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
  if (!hasPermission(project.members[0]?.role, "chat.ask", Boolean(user.isAdmin))) {
    return NextResponse.json({ error: "Role Anda tidak punya akses AI Chat." }, { status: 403 });
  }

  let body: { message?: string; threadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  const content = (body.message || "").trim();
  if (!content) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }
  if (content.length > CHAT_MESSAGE_MAX) {
    return NextResponse.json({ error: `Pesan maksimal ${CHAT_MESSAGE_MAX} karakter.` }, { status: 400 });
  }

  // Quota check
  if ((await projectTokensToday(project.id)) >= dailyTokenQuota()) {
    return NextResponse.json(
      { error: "Kuota AI project hari ini sudah habis. Reset pukul 00:00 WIB." },
      { status: 429 }
    );
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

  // Resolve or create thread
  let threadId = body.threadId;
  let activeThread = null;
  if (threadId) {
    activeThread = await prisma.chatThread.findFirst({
      where: { id: threadId, projectId: project.id },
    });
  }

  if (!activeThread) {
    // Generate simple title from first question (up to 50 chars)
    const title = content.length > 50 ? `${content.slice(0, 47)}...` : content;
    activeThread = await prisma.chatThread.create({
      data: {
        projectId: project.id,
        userId: user.id,
        title,
      },
    });
    threadId = activeThread.id;
  } else {
    await prisma.chatThread.update({
      where: { id: activeThread.id },
      data: { updatedAt: new Date() },
    });
  }

  // 1. Simpan pesan User dengan threadId
  const userMsg = await prisma.chatMessage.create({
    data: {
      projectId: project.id,
      threadId,
      userId: user.id,
      role: "USER",
      content,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // 2. Ambil riwayat percakapan terkini dalam thread ini (maks 10 pesan untuk hemat token)
  const history = await prisma.chatMessage.findMany({
    where: { projectId: project.id, threadId },
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

  // NDJSON stream
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      // Kirim thread info awal agar client sinkron
      send({
        thread: {
          id: activeThread.id,
          title: activeThread.title,
        },
        userMessage: userMsg,
      });

      try {
        const { reply, usage } = await askClaudeProjectChat(formattedHistory, ctx, (step) => send({ step }));
        const assistantMsg = await prisma.chatMessage.create({
          data: {
            projectId: project.id,
            threadId,
            userId: user.id!,
            role: "ASSISTANT",
            content: reply,
            tokenUsage: { ...usage },
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });
        send({ message: assistantMsg });
      } catch (err: unknown) {
        console.error("chat error:", err instanceof Error ? err.name : "unknown");
        send({ error: "Gagal memproses chat AI. Coba lagi nanti." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
