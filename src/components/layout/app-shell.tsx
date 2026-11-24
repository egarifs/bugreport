import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppSidebar } from "./app-sidebar";
import { TopProgressBar } from "./top-progress-bar";
import { RouteTransition } from "./route-transition";
import { Suspense } from "react";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import Link from "next/link";
import { resetMySandbox } from "@/app/onboarding/actions";

function SandboxBand() {
  return (
    <div role="note" className="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-100 text-slate-900 text-sm border-b border-slate-300">
      <b>Project Latihan</b>
      <span>Data contoh. Tidak memengaruhi project asli.</span>
      <span className="ml-auto flex gap-3">
        <form action={resetMySandbox}><button className="underline font-bold min-h-[32px]">Reset data</button></form>
        <Link href="/onboarding" className="underline font-bold min-h-[32px] flex items-center">Kembali ke panduan</Link>
      </span>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  activeProjectKey?: string;
}

export async function AppShell({ children, activeProjectKey }: AppShellProps) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; isAdmin?: boolean; status?: string }
    | undefined;

  // If not logged in, render children without sidebar (handled by login page)
  if (!user || !user.id) return <>{children}</>;
  const sandbox = activeProjectKey
    ? await prisma.project.findFirst({ where: { key: activeProjectKey.toUpperCase(), isSandbox: true, sandboxOwnerId: user.id }, select: { key: true } })
    : null;
  // PENDING: hanya halaman project Latihan miliknya, tanpa sidebar penuh. Status lain: tanpa shell.
  if (user.status !== "ACTIVE") {
    return user.status === "PENDING" && sandbox ? <div className="min-h-screen bg-slate-50"><SandboxBand />{children}</div> : <>{children}</>;
  }

  // Fetch projects user has access to
  const projects = await prisma.project.findMany({
    where: user.isAdmin
      ? { OR: [{ isSandbox: false }, { sandboxOwnerId: user.id }] }
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
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          role: options.find((p) => p.key === activeProjectKey)?.role || options[0]?.role,
        }}
        projects={options}
        activeProjectKey={activeProjectKey}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {sandbox && <SandboxBand />}
        <RouteTransition>
          {children}
        </RouteTransition>
      </div>
    </div>
  );
}
