import { hasPermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import { ProjectChatBox } from "./chat-box";

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");
  if (!hasPermission(project.members[0]?.role, "chat.ask", user.isAdmin)) redirect(`/projects/${project.key}`);

  const messages = await prisma.chatMessage.findMany({
    where: {
      projectId: project.id,
      userId: user.id,
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {project.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              Project AI Assistant (Claude)
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800">
              Tool Use Active
            </span>
          </div>
        </header>

        <main className="p-4 flex-1">
          <ProjectChatBox
            projectKey={project.key}
            initialMessages={messages.map((m) => ({
              id: m.id,
              role: m.role as "USER" | "ASSISTANT",
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </main>
      </div>
    </AppShell>
  );
}
