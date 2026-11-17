import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { statusLabel } from "@/lib/status-dictionary";
import { SeverityBadge } from "@/components/ui/bug-badges";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PortalShell } from "@/components/layout/portal-shell";

const DONE = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];
const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

export default async function PortalPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ f?: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; email?: string | null; isAdmin?: boolean } | undefined;
  if (!user?.id) redirect("/login");
  const { key } = await params;
  const { f } = await searchParams;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } } },
  });
  if (!project) notFound();
  const role = project.members[0]?.role ?? null;
  if (!hasPermission(role, "project.read", user.isAdmin)) redirect("/projects");

  // "Bug kami": semua bug yang dilaporkan anggota ber-peran CLIENT di project ini. Komentar internal tidak ditampilkan di sini.
  const clients = await prisma.projectMember.findMany({ where: { projectId: project.id, role: "CLIENT" }, select: { userId: true } });
  const bugs = await prisma.bug.findMany({
    where: { projectId: project.id, reporterId: { in: clients.map((c) => c.userId) } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { reporter: { select: { id: true, name: true, email: true } } },
  });
  const active = bugs.filter((b) => !DONE.includes(b.status));
  const finished = bugs.filter((b) => DONE.includes(b.status));
  const shown = f === "active" ? active : f === "done" ? finished : bugs;
  const canReport = hasPermission(role, "bug.create", user.isAdmin);
  const base = `/projects/${project.key}/portal`;
  const tab = (v: string, l: string) => (
    <Link key={v} href={v ? `${base}?f=${v}` : base} aria-current={(f ?? "") === v ? "true" : undefined}
      className={`px-3 min-h-[44px] flex items-center text-sm font-bold rounded ${(f ?? "") === v ? "bg-surface border border-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-100"}`}>{l}</Link>
  );

  return (
    <PortalShell projectKey={project.key} projectName={project.name} active="" canReport={canReport}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Bug yang dilaporkan tim</h1>
          <div role="group" aria-label="Saring bug" className="flex gap-1">
            {tab("active", `Aktif ${active.length}`)}{tab("done", `Selesai ${finished.length}`)}{tab("", "Semua")}
          </div>
        </div>
        <div className="overflow-x-auto bg-surface border border-slate-200 rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs text-slate-600">
              <tr><th className="p-3">ID</th><th className="p-3">Judul</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Dilaporkan</th><th className="p-3">Info</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-slate-500">Belum ada bug di tampilan ini.</td></tr>}
              {shown.map((b) => (
                <tr key={b.id}>
                  <td className="p-3 font-mono"><Link href={`/projects/${project.key}/bugs/${b.number}`} className="text-link hover:underline">{b.key}</Link></td>
                  <td className="p-3">{b.title}</td>
                  <td className="p-3"><SeverityBadge severity={b.severity} /></td>
                  <td className="p-3 font-bold">{statusLabel(b.status, "portal")}</td>
                  <td className="p-3 text-slate-600">{b.reporter.id === user.id ? "Anda" : b.reporter.name || b.reporter.email} · {fmt(b.createdAt)}</td>
                  <td className="p-3 text-xs text-slate-600">{b.fixedInVersion ? `Diperbaiki di ${b.fixedInVersion}` : b.dueAt && !DONE.includes(b.status) ? `Target ${fmt(b.dueAt)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600">Status disederhanakan untuk klien. Komentar internal tim tidak tampil di portal.</p>
    </PortalShell>
  );
}
