import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getProjectReport } from "@/lib/report";
import { SEVERITY_STYLE, STATUS_LABEL, SeverityBadge } from "@/components/ui/bug-badges";
import { computeTrend } from "@/lib/trend";
import type { BugSeverity, BugStatus } from "@prisma/client";
import { SummaryTab } from "./summary-tab";
import { exitStatus } from "@/lib/stlc";
import { exitFacts } from "@/lib/stlc-service";
import { PerformanceTab } from "./performance-tab";

const SEVERITIES = ["BLOCKER", "HIGH", "MEDIUM", "LOW"] as const;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ version?: string; tab?: string; sprint?: string; module?: string; user?: string; type?: string; period?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;
  if (!user?.id) redirect("/login");

  const { key } = await params;
  const { version, tab, sprint: sprintId, module: moduleId, user: targetUser, type: ptype, period } = await searchParams;
  const isTrend = tab === "trend";
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } } },
  });
  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");

  if (isTrend && project.members[0]?.role === "CLIENT" && !user.isAdmin) redirect(`/projects/${project.key}/reports`);
  if (tab === "performance") {
    const role = project.members[0]?.role ?? null;
    if (role === "CLIENT" || role === "VIEWER") redirect(`/projects/${project.key}/reports`);
    return <PerformanceTab project={{ id: project.id, key: project.key }} userId={user.id} role={role} isLead={role === "ADMIN" || Boolean(user.isAdmin)} targetId={targetUser} type={ptype === "quarter" ? "quarter" : "month"} pkey={period} nav={<ReportTabs projectKey={project.key} active="performance" />} />;
  }
  if (tab === "summary") {
    if (project.members[0]?.role === "CLIENT" && !user.isAdmin) redirect(`/projects/${project.key}/reports`);
    return <SummaryTab project={{ id: project.id, key: project.key }} sprintId={sprintId} moduleId={moduleId} isLead={project.members[0]?.role === "ADMIN" || Boolean(user.isAdmin)} nav={<ReportTabs projectKey={project.key} active="summary" />} />;
  }
  if (isTrend) return <TrendTab project={{ id: project.id, key: project.key }} sprintId={sprintId} />;
  const r = await getProjectReport(project.id, version?.trim() || undefined);
  const isClient = project.members[0]?.role === "CLIENT" && !user.isAdmin;
  // Kriteria keluar dari Test Plan yang disetujui (informatif, tidak memblokir rilis). Disembunyikan dari Klien.
  const plan = isClient ? null : await prisma.stlcDoc.findFirst({ where: { projectId: project.id, kind: "TEST_PLAN", status: "APPROVED" }, orderBy: { approvedAt: "desc" }, select: { id: true, title: true } });
  const exit = plan ? exitStatus(await exitFacts(project.id)) : [];
  const maxSev = Math.max(1, ...SEVERITIES.map((s) => r.openBySeverity[s] ?? 0));

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="p-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Laporan kesiapan rilis</h1>
          {!isClient && <ReportTabs projectKey={project.key} active="release" />}
          {!isClient && <a
            href={`/api/projects/${project.key}/export`}
            className="press-snappy px-3.5 py-2 text-sm font-bold rounded bg-surface border border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400 shadow-xs"
          >
            Export CSV
          </a>}
        </header>

        <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3">
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
                ? "bg-ok-bg/80 border-ok-border text-ok" 
                : "bg-bad-bg/90 border-bad-border text-bad"
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
              r.releaseReady ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"
            }`}>
              {r.releaseReady ? "Ready" : "Blocked"}
            </span>
          </div>
          {!isClient && r.releaseBlockers.length > 0 && (
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

        {plan && (
          <section aria-label="Kriteria keluar Test Plan" className="bg-surface border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-slate-900 mb-2">Kriteria keluar · <Link className="underline" href={`/projects/${project.key}/stlc/${plan.id}`}>{plan.title}</Link></h2>
            <ul className="text-sm space-y-1">{exit.map((e) => <li key={e.text}><span aria-hidden>{e.ok ? "✓" : "✕"}</span> <span className="sr-only">{e.ok ? "Terpenuhi:" : "Belum:"}</span>{e.text}</li>)}</ul>
            <p className="text-xs text-slate-500 mt-2">Informatif: tidak memblokir rilis.</p>
          </section>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {/* Card 1: Severity Progress Bar */}
          <section className="bg-surface border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
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
          <section className="bg-surface border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
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
                  <td className="py-2 text-right font-mono font-semibold text-warn tabular-nums">{r.reopened}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Card 3: Workload per Assignee (internal) */}
          {!isClient && <section className="bg-surface border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
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
          </section>}

          {/* Card 4: Stale Drafts (internal) */}
          {!isClient && <section className="bg-surface border border-slate-200 rounded-lg p-5 shadow-xs hover:border-slate-300 transition-colors duration-150">
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
          </section>}
        </div>
      </div>
    </AppShell>
  );
}

function ReportTabs({ projectKey, active }: { projectKey: string; active: "release" | "trend" | "summary" | "performance" }) {
  const cls = (a: boolean) => `px-3 min-h-[44px] flex items-center text-sm font-bold border-b-2 ${a ? "border-ink text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`;
  return (
    <nav aria-label="Jenis laporan" className="flex gap-2 w-full order-last border-b border-slate-200">
      <Link href={`/projects/${projectKey}/reports?tab=summary`} aria-current={active === "summary" ? "page" : undefined} className={cls(active === "summary")}>Ringkasan</Link>
      <Link href={`/projects/${projectKey}/reports`} aria-current={active === "release" ? "page" : undefined} className={cls(active === "release")}>Kesiapan rilis</Link>
      <Link href={`/projects/${projectKey}/reports?tab=trend`} aria-current={active === "trend" ? "page" : undefined} className={cls(active === "trend")}>Tren</Link>
      <Link href={`/projects/${projectKey}/reports?tab=performance`} aria-current={active === "performance" ? "page" : undefined} className={cls(active === "performance")}>Performa</Link>
    </nav>
  );
}

async function TrendTab({ project, sprintId }: { project: { id: string; key: string }; sprintId?: string }) {
  const sprints = await prisma.sprint.findMany({ where: { projectId: project.id }, orderBy: { startsAt: "desc" } });
  const sprint = sprints.find((x) => x.id === sprintId);
  const to = sprint ? new Date(+sprint.endsAt + 86_400_000) : new Date();
  const from = sprint ? sprint.startsAt : new Date(+to - 8 * 7 * 86_400_000);
  const bugs = await prisma.bug.findMany({
    where: { projectId: project.id, status: { not: "DRAFT" }, ...(sprint ? { sprintId: sprint.id } : {}) },
    select: { id: true, createdAt: true, severity: true, status: true, reopenCount: true, dueAt: true, module: { select: { name: true } } },
  });
  const closes = await prisma.auditLog.findMany({
    where: { projectId: project.id, action: "bug.status_change", entityId: { in: bugs.map((b) => b.id) }, changes: { path: ["after", "status"], equals: "CLOSED" } },
    orderBy: { createdAt: "asc" },
    select: { entityId: true, createdAt: true },
  });
  const firstClose = new Map<string, Date>();
  for (const c of closes) if (c.entityId && !firstClose.has(c.entityId)) firstClose.set(c.entityId, c.createdAt);
  const t = computeTrend(bugs.map((b) => ({ ...b, moduleName: b.module?.name ?? null, closedAt: firstClose.get(b.id) ?? null, ended: ["INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX", "CLOSED"].includes(b.status) })), from, to);
  const max = Math.max(1, ...t.weeks.flatMap((w) => [w.masuk, w.selesai]));
  const stat = (v: string, l: string) => (
    <div className="bg-surface border border-slate-200 rounded p-4"><div className="text-2xl font-bold text-slate-900">{v}</div><div className="text-xs text-slate-500">{l}</div></div>
  );
  const dm = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="p-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Laporan</h1>
          <form className="flex items-center gap-2 text-xs">
            <input type="hidden" name="tab" value="trend" />
            <label htmlFor="sprint" className="text-slate-600">Periode</label>
            <select id="sprint" name="sprint" defaultValue={sprint?.id ?? ""} className="px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px]">
              <option value="">8 minggu terakhir</option>
              {sprints.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button className="px-3 border border-slate-300 rounded hover:bg-slate-50 min-h-[44px] font-bold">Terapkan</button>
          </form>
          <ReportTabs projectKey={project.key} active="trend" />
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stat(String(t.masuk), "Bug masuk")}
          {stat(String(t.selesai), "Bug selesai")}
          {stat(String(t.late), "Lewat tenggat/SLA")}
          {stat(`${t.reopenRate}%`, "Bug pernah dibuka ulang")}
          {stat(t.medianDays === null ? "—" : `${t.medianDays.toFixed(1).replace(".", ",")} hari`, "Median sampai Closed")}
        </div>

        <section className="bg-surface border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Bug masuk vs selesai per minggu</h2>
            <div className="flex gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-ink" />Masuk</span>
              <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-ok" />Selesai</span>
            </div>
          </div>
          <div className="flex items-end gap-3 h-40" role="img" aria-label={`Grafik batang: ${t.weeks.map((w) => `minggu ${dm.format(w.start)} masuk ${w.masuk}, selesai ${w.selesai}`).join("; ")}`}>
            {t.weeks.map((w) => (
              <div key={+w.start} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="flex items-end gap-1 w-full h-full justify-center">
                  <div className="w-1/3 bg-ink rounded-t" style={{ height: `${(w.masuk / max) * 100}%` }} title={`Masuk ${w.masuk}`} />
                  <div className="w-1/3 bg-ok rounded-t" style={{ height: `${(w.selesai / max) * 100}%` }} title={`Selesai ${w.selesai}`} />
                </div>
                <span className="text-[10px] text-slate-500">{dm.format(w.start)}</span>
              </div>
            ))}
          </div>
          <table className="sr-only"><caption>Data grafik</caption><thead><tr><th>Minggu</th><th>Masuk</th><th>Selesai</th></tr></thead>
            <tbody>{t.weeks.map((w) => <tr key={+w.start}><td>{dm.format(w.start)}</td><td>{w.masuk}</td><td>{w.selesai}</td></tr>)}</tbody></table>
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="bg-surface border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Lewat tenggat per severity</h2>
            <table className="w-full text-sm"><tbody>
              {t.sev.map((x) => (
                <tr key={x.severity}>
                  <td className="py-1.5 w-24">{SEVERITY_STYLE[x.severity].label}</td>
                  <td className="py-1.5"><div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-bad rounded" style={{ width: `${x.total ? (x.late / x.total) * 100 : 0}%` }} /></div></td>
                  <td className="py-1.5 w-20 text-right"><b>{x.late}</b> / {x.total}</td>
                </tr>
              ))}
            </tbody></table>
          </section>
          <section className="bg-surface border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Modul paling banyak bug</h2>
            {t.modules.length === 0 ? <p className="text-xs text-slate-500">Belum ada data.</p> : (
              <table className="w-full text-sm"><tbody>
                {t.modules.map((m) => <tr key={m.name}><td className="py-1.5">{m.name}</td><td className="py-1.5 font-bold">{m.total}</td><td className="py-1.5 text-xs text-slate-500">{m.reopen} reopen</td></tr>)}
              </tbody></table>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
