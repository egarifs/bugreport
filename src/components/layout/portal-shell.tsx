import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";

// Kerangka portal klien tanpa sidebar internal. Cek login + project.read; kembalikan project & izin.
export async function portalContext(key: string) {
  const user = (await auth())?.user as { id?: string; isAdmin?: boolean } | undefined;
  if (!user?.id) redirect("/login");
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, include: { members: { where: { userId: user.id } } } });
  if (!project) notFound();
  const role = project.members[0]?.role ?? null;
  if (!hasPermission(role, "project.read", user.isAdmin)) redirect("/projects");
  const can = (p: Permission) => hasPermission(role, p, user.isAdmin);
  return { user: { id: user.id }, project, can };
}

const TABS = [["", "Bug kami"], ["/rilis", "Status rilis"], ["/dokumen", "Dokumen"]] as const;

export function PortalShell({ projectKey, projectName, active, canReport, children }: { projectKey: string; projectName: string; active: "" | "/rilis" | "/dokumen"; canReport: boolean; children: React.ReactNode }) {
  const base = `/projects/${projectKey}/portal`;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-surface border-b border-slate-200 px-6 flex flex-wrap items-center gap-4">
        <div className="py-3"><b>{projectKey}</b> <span className="text-slate-600">{projectName}</span> <span className="text-xs text-slate-500">· Portal klien</span></div>
        <nav aria-label="Portal" className="flex gap-1 ml-4">
          {TABS.map(([s, l]) => (
            <Link key={s} href={base + s} aria-current={active === s ? "page" : undefined}
              className={`px-3 min-h-[44px] flex items-center text-sm ${active === s ? "font-bold border-b-2 border-ink" : "text-slate-600 hover:text-slate-900"}`}>{l}</Link>
          ))}
        </nav>
        {canReport && (
          <Link href={`/projects/${projectKey}/bugs/new`} className="ml-auto px-3.5 min-h-[44px] flex items-center bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded">
            Laporkan bug
          </Link>
        )}
      </header>
      <main className="max-w-5xl mx-auto p-6 space-y-4">{children}</main>
    </div>
  );
}
