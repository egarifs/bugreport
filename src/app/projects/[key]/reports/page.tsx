import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getProjectReport } from "@/lib/report";

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
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{project.key} — Health & Release Readiness</h1>
          <a
            href={`/api/projects/${project.key}/export`}
            className="px-3 py-1.5 text-xs font-medium rounded bg-slate-900 text-white hover:bg-slate-800"
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
              r.releaseReady ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
            }`}
          >
            {r.releaseReady
              ? "Ready — tidak ada Blocker/High aktif"
              : `Not ready — ${r.releaseBlockers.length} Blocker/High belum Closed`}
          </div>
          {r.releaseBlockers.length > 0 && (
            <ul className="text-xs space-y-1">
              {r.releaseBlockers.map((b) => (
                <li key={b.key}>
                  <Link href={`/projects/${project.key}/bugs/${b.key.split("-").pop()}`} className="font-mono text-blue-600 hover:underline">
                    {b.key}
                  </Link>{" "}
                  [{b.severity} / {b.status}] {b.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Open by severity</h2>
            {SEVERITIES.map((s) => {
              const n = r.openBySeverity[s] ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs mb-1.5">
                  <span className="w-16">{s}</span>
                  <div className="flex-1 bg-slate-100 rounded h-3">
                    <div className="bg-slate-800 h-3 rounded" style={{ width: `${(n / maxSev) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono">{n}</span>
                </div>
              );
            })}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">By status</h2>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(r.byStatus).map(([s, n]) => (
                  <tr key={s} className="border-b border-slate-100">
                    <td className="py-1">{s}</td>
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
