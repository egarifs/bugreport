import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppSidebar } from "./app-sidebar";

interface AppShellProps {
  children: React.ReactNode;
  activeProjectKey?: string;
}

export async function AppShell({ children, activeProjectKey }: AppShellProps) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; isAdmin?: boolean; status?: string }
    | undefined;

  // If not logged in or pending, render children without sidebar (handled by login / pending pages)
  if (!user || user.status !== "ACTIVE" || !user.id) {
    return <>{children}</>;
  }

  // Fetch projects user has access to
  const projects = await prisma.project.findMany({
    where: user.isAdmin
      ? {}
      : {
          members: { some: { userId: user.id } },
        },
    select: {
      id: true,
      key: true,
      name: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        }}
        projects={projects}
        activeProjectKey={activeProjectKey}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
