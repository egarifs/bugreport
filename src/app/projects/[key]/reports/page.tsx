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
            className="press-snappy px-3.5 py-2 text-sm font-bold rounded bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400 shadow-xs"
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
            className={`rounded-lg p-4 text-sm font-semibold flex items-center justify-between border transition-all duration-200 ${
              r.releaseReady 
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                : "bg-rose-50/90 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full shrink-0 ${r.releaseReady ? "bg-emerald-500 ready-pulse" : "bg-rose-600"}`} aria-hidden="true" />
              <span>
                {r.releaseReady
                  ? "Siap rilis: tidak ada Blocker atau High yang aktif"
                  : `Belum siap rilis: masih ada ${r.releaseBlockers.length} bug Blocker/High yang belum selesai`}
              </span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              r.releaseReady ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}>
              {r.releaseReady ? "Ready" : "Blocked"}
            </span>
          </div>
          {r.releaseBlockers.length > 0 && (
            <ul className="text-xs space-y-1">
              {r.releaseBlockers.map((b) => (
                <li key={b.key}>
                  <Link 
                    href={`/projects/${project.key}/bugs/${b.key.split("-").pop()}`} 
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors duration-100"
                  >
                    <span className="font-mono font-bold text-action hover:underline shrink-0">{b.key}</span>
                    <SeverityBadge severity={b.severity as BugSeverity} />
                    <span className="text-slate-500 shrink-0">[{STATUS_LABEL[b.status as BugStatus] ?? b.status}]</span>
                    <span className="text-slate-900 truncate">{b.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Card 1: Severity Progress Bar */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">Bug aktif per severity</h2>
              <span className="text-xs text-slate-500 font-mono">Beban rilis</span>
            </div>
            <div className="space-y-3">
              {SEVERITIES.map((s, idx) => {
                const n = r.openBySeverity[s] ?? 0;
                const pct = (n / maxSev) * 100;
                return (
                  <div key={s} className="group">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-medium text-slate-700">{SEVERITY_STYLE[s].label}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">{n}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full ${SEVERITY_STYLE[s].strip} bar-animate`}
                        style={{
                          width: `${pct}%`,
                          animationDelay: `${idx * 75}ms`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card 2: Status Breakdown */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Distribusi status bug</h2>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {Object.entries(r.byStatus).map(([s, n]) => (
                  <tr key={s} className="hover:bg-slate-50 transition-colors duration-100">
                    <td className="py-2 text-slate-700 font-medium">{STATUS_LABEL[s as BugStatus] ?? s}</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900 tabular-nums">{n}</td>
                  </tr>
                ))}
                <tr className="hover:bg-slate-50 transition-colors duration-100">
                  <td className="py-2 text-slate-500">Pernah reopen (terdeteksi regresi)</td>
                  <td className="py-2 text-right font-mono font-semibold text-amber-700 tabular-nums">{r.reopened}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Card 3: Workload per Assignee */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Workload aktif per assignee</h2>
            {r.workload.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada bug aktif yang ditugaskan.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {r.workload.map((w) => (
                    <tr key={w.assignee} className="hover:bg-slate-50 transition-colors duration-100">
                      <td className="py-2 text-slate-700 font-medium">{w.assignee}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900 tabular-nums">{w.count} bug</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Card 4: Stale Drafts */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Draft &gt; 3 hari belum direview</h2>
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
