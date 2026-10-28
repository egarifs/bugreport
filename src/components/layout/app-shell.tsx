import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppSidebar } from "./app-sidebar";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";

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
      members: { where: { userId: user.id }, select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const options = projects.map(({ members, ...p }) => {
    const role = members[0]?.role;
    return { ...p, role, perms: ROLE_PERMISSIONS.ADMIN.filter((perm) => hasPermission(role, perm, user.isAdmin)) };
  });

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-50">
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        }}
        projects={options}
        activeProjectKey={activeProjectKey}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
