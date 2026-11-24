import { hasPermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import { ProjectChatBox } from "./chat-box";

export default async function ProjectChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ threadId?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key } = await params;
  const { threadId } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");
  if (!hasPermission(project.members[0]?.role, "chat.ask", user.isAdmin)) return <ForbiddenState projectKey={project.key} />;

  // 1. Ambil list semua thread dalam project (shared untuk semua member)
  const threads = await prisma.chatThread.findMany({
    where: { projectId: project.id },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
    take: 50,
  });

  // 2. Tentukan thread aktif (default ke thread pertama jika ada)
  const activeThreadId = threadId || threads[0]?.id || null;

  // 3. Ambil pesan untuk thread yang aktif
  const messages = activeThreadId
    ? await prisma.chatMessage.findMany({
        where: {
          projectId: project.id,
          threadId: activeThreadId,
        },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        take: 100,
      })
    : [];

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-surface border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {project.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              Project AI Assistant & Threads
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Shared Team Threads
            </span>
          </div>
        </header>

        <main className="p-4 flex-1">
          <ProjectChatBox
            projectKey={project.key}
            currentUserId={user.id}
            initialThreads={threads.map((t) => ({
              id: t.id,
              title: t.title,
              creatorName: t.user?.name || t.user?.email || "Unknown",
              creatorId: t.userId,
              messageCount: t._count.messages,
              updatedAt: t.updatedAt.toISOString(),
            }))}
            initialActiveThreadId={activeThreadId}
            initialMessages={messages.map((m) => ({
              id: m.id,
              role: m.role as "USER" | "ASSISTANT",
              content: m.content,
              authorName: m.user?.name || m.user?.email || "Unknown",
              authorId: m.userId,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </main>
      </div>
    </AppShell>
  );
}
