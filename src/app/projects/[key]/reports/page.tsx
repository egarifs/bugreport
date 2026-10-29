import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getProjectReport } from "@/lib/report";
import { SEVERITY_STYLE, STATUS_LABEL, SeverityBadge } from "@/components/ui/bug-badges";
import type { BugSeverity, BugStatus } from "@prisma/client";

const SEVERITIES = ["BLOCKER", "HIGH", "MEDIUM", "LOW"] as const;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;
  if (!user?.id) redirect("/login");

  const { key } = await params;
  const { version } = await searchParams;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } } },
  });
  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");

  const r = await getProjectReport(project.id, version?.trim() || undefined);
  const maxSev = Math.max(1, ...SEVERITIES.map((s) => r.openBySeverity[s] ?? 0));

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="p-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Laporan kesiapan rilis</h1>
          <a
            href={`/api/projects/${project.key}/export`}
            className="px-3.5 py-2 text-sm font-bold rounded bg-white border border-slate-300 text-slate-800 hover:bg-slate-100"
          >
            Export CSV
          </a>
        </header>

        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <form className="flex items-center gap-2 text-xs">
            <label htmlFor="version" className="text-slate-600">Target version / build</label>
            <input
              id="version"
              name="version"
              defaultValue={version ?? ""}
              placeholder="semua versi"
              className="px-2 py-1 border border-slate-300 rounded"
            />
            <button className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50">Cek</button>
          </form>
          <div
            role="status"
            className={`rounded p-3 text-sm font-semibold ${
              r.releaseReady ? "bg-emerald-50 text-emerald-800" : "bg-sev-blocker-bg text-sev-blocker"
            }`}
          >
            {r.releaseReady
              ? "Siap rilis: tidak ada Blocker/High aktif"
              : `Belum siap: ${r.releaseBlockers.length} bug Blocker/High belum ditutup`}
          </div>
          {r.releaseBlockers.length > 0 && (
            <ul className="text-xs space-y-1">
              {r.releaseBlockers.map((b) => (
                <li key={b.key}>
                  <Link href={`/projects/${project.key}/bugs/${b.key.split("-").pop()}`} className="font-mono font-bold text-action hover:underline">
                    {b.key}
                  </Link>{" "}
                  <SeverityBadge severity={b.severity as BugSeverity} />{" "}<span className="text-slate-500">{STATUS_LABEL[b.status as BugStatus] ?? b.status}</span> {b.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Bug aktif per severity</h2>
            {SEVERITIES.map((s) => {
              const n = r.openBySeverity[s] ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs mb-1.5">
                  <span className="w-16">{SEVERITY_STYLE[s].label}</span>
                  <div className="flex-1 bg-slate-100 rounded h-3">
                    <div className={`h-3 rounded ${SEVERITY_STYLE[s].strip}`} style={{ width: `${(n / maxSev) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono">{n}</span>
                </div>
              );
            })}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Per status</h2>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(r.byStatus).map(([s, n]) => (
                  <tr key={s} className="border-b border-slate-100">
                    <td className="py-1">{STATUS_LABEL[s as BugStatus] ?? s}</td>
                    <td className="py-1 text-right font-mono">{n}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 text-slate-500">Pernah reopen</td>
                  <td className="py-1 text-right font-mono">{r.reopened}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Workload aktif per assignee</h2>
            <table className="w-full text-xs">
              <tbody>
                {r.workload.map((w) => (
                  <tr key={w.assignee} className="border-b border-slate-100">
                    <td className="py-1">{w.assignee}</td>
                    <td className="py-1 text-right font-mono">{w.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Draft &gt; 3 hari belum direview</h2>
            {r.staleDrafts.length === 0 ? (
              <p className="text-xs text-slate-500">Tidak ada.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {r.staleDrafts.map((d) => (
                  <li key={d.key}>
                    <span className="font-mono">{d.key}</span> {d.title}{" "}
                    <span className="text-slate-500">
                      ({Math.floor((Date.now() - d.createdAt.getTime()) / 86_400_000)} hari)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
