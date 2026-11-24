import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { STATUS_LABEL, SEVERITY_STYLE } from "@/components/ui/bug-badges";
import { AGE_BUCKETS, SEVERITIES, burndown, computeSummary, foundPerWeek, workload } from "@/lib/summary";
import { computeTrend } from "@/lib/trend";
import type { BugSeverity } from "@prisma/client";

// Ramp satu hue: Low terang → Blocker gelap (README F12). Seri kategori: biru = Open, oranye = Passed.
const RAMP: Record<BugSeverity, string> = { LOW: "#86b6ef", MEDIUM: "#5598e7", HIGH: "#256abf", BLOCKER: "#104281" };
const OPEN = "#2a78d6", PASSED = "#eb6834";

type Row = { label: string; href?: string; parts: { value: number; color: string; name: string }[] };

function BarChart({ title, note, rows, legend }: { title: string; note?: string; rows: Row[]; legend?: { name: string; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)));
  return (
    <section className="bg-surface border border-slate-200 rounded-lg p-4">
      <h2 className="text-sm font-bold text-slate-900 mb-3">{title}</h2>
      {legend && (
        <ul className="flex flex-wrap gap-3 mb-3 text-xs text-slate-700">
          {legend.map((l) => <li key={l.name} className="flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-sm" style={{ background: l.color }} />{l.name}</li>)}
        </ul>
      )}
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const total = r.parts.reduce((a, p) => a + p.value, 0);
          const label = <span className="w-40 shrink-0 truncate text-xs text-slate-700">{r.label}</span>;
          return (
            <li key={r.label} className="flex items-center gap-2" title={r.parts.map((p) => `${p.name}: ${p.value}`).join(", ")}>
              {r.href ? <Link href={r.href} className="flex">{label}</Link> : label}
              <div className="flex-1 flex gap-0.5 h-5">
                {r.parts.filter((p) => p.value > 0).map((p) => (
                  <div key={p.name} className="h-full rounded-[4px] first:rounded-l-sm" style={{ width: `${(p.value / max) * 100}%`, background: p.color }} />
                ))}
              </div>
              <span className="w-8 text-right text-xs font-bold text-slate-900 tabular-nums">{total}</span>
            </li>
          );
        })}
      </ul>
      {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
      <TableView head={["", ...(rows[0]?.parts.map((p) => p.name) ?? [])]} rows={rows.map((r) => [r.label, ...r.parts.map((p) => String(p.value))])} />
    </section>
  );
}

function TableView({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-bold text-slate-600 min-h-[32px] flex items-center">Lihat sebagai tabel</summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left">
          <thead><tr>{head.map((h, i) => <th key={i} scope="col" className="py-1 pr-3 font-bold text-slate-700">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]} className="border-t border-slate-100">{r.map((c, i) => <td key={i} className="py-1 pr-3 tabular-nums">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

type Series = { name: string; color: string; values: number[]; dashed?: boolean };
function LineChart({ title, labels, series, note }: { title: string; labels: string[]; series: Series[]; note?: string }) {
  const W = 480, H = 160, P = 24;
  const max = Math.max(1, ...series.flatMap((x) => x.values));
  const x = (i: number) => P + (labels.length > 1 ? (i * (W - 2 * P)) / (labels.length - 1) : 0);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  return (
    <section className="bg-surface border border-slate-200 rounded-lg p-4">
      <h2 className="text-sm font-bold text-slate-900 mb-3">{title}</h2>
      <ul className="flex flex-wrap gap-3 mb-2 text-xs text-slate-700">
        {series.map((l) => <li key={l.name} className="flex items-center gap-1.5"><span aria-hidden className="w-3 h-0.5" style={{ background: l.color }} />{l.name}</li>)}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="w-full h-auto">
        {[0, 0.5, 1].map((f) => <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke="#E2DDD3" />)}
        <text x={2} y={y(max) + 4} fontSize="10" fill="#5C564C">{max}</text>
        <text x={P} y={H - 6} fontSize="10" fill="#5C564C">{labels[0]}</text>
        <text x={W - P} y={H - 6} fontSize="10" fill="#5C564C" textAnchor="end">{labels[labels.length - 1]}</text>
        {series.map((l) => (
          <polyline key={l.name} fill="none" stroke={l.color} strokeWidth="2" strokeDasharray={l.dashed ? "4 4" : undefined} points={l.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
      </svg>
      {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      <TableView head={["", ...series.map((l) => l.name)]} rows={labels.map((lb, i) => [lb, ...series.map((l) => String(l.values[i]))])} />
    </section>
  );
}

const DAY = 86_400_000;
const TEST_COLOR = { PASS: "#0ca30c", FAIL: "#d03b3b", BLOCKED: "#fab219", NOT_RUN: "#c9c2b5" } as const;
const TEST_LABEL = { PASS: "✓ Lolos", FAIL: "✕ Gagal", BLOCKED: "■ Terblokir", NOT_RUN: "○ Belum" } as const;
const ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "REOPENED"] as const;

export async function SummaryTab({ project, nav, sprintId, moduleId, isLead }: { project: { id: string; key: string }; nav: React.ReactNode; sprintId?: string; moduleId?: string; isLead: boolean }) {
  const [sprints, modules] = await Promise.all([
    prisma.sprint.findMany({ where: { projectId: project.id }, orderBy: { startsAt: "desc" } }),
    prisma.module.findMany({ where: { projectId: project.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const sprint = sprints.find((x) => x.id === sprintId);
  const mod = modules.find((m) => m.id === moduleId);
  const to = sprint ? new Date(+sprint.endsAt + DAY) : new Date();
  const from = sprint ? sprint.startsAt : new Date(+to - 8 * 7 * DAY);
  const bugs = await prisma.bug.findMany({
    where: { projectId: project.id, ...(sprint ? { sprintId: sprint.id } : {}), ...(mod ? { moduleId: mod.id } : {}) },
    select: { id: true, status: true, severity: true, priority: true, createdAt: true, dueAt: true, reopenCount: true, module: { select: { name: true } }, bugAssignees: { select: { user: { select: { name: true, email: true } } } } },
  });
  const closes = await prisma.auditLog.findMany({
    where: { projectId: project.id, action: "bug.status_change", entityId: { in: bugs.map((b) => b.id) }, changes: { path: ["after", "status"], equals: "CLOSED" } },
    orderBy: { createdAt: "asc" }, select: { entityId: true, createdAt: true },
  });
  const firstClose = new Map<string, Date>();
  for (const c of closes) if (c.entityId && !firstClose.has(c.entityId)) firstClose.set(c.entityId, c.createdAt);
  const live = bugs.filter((b) => b.status !== "DRAFT");
  const sm = computeSummary(live.map((b) => ({ status: b.status, severity: b.severity, priority: b.priority, createdAt: b.createdAt, moduleName: b.module?.name ?? null })), new Date());
  const t = computeTrend(live.map((b) => ({ id: b.id, createdAt: b.createdAt, severity: b.severity, moduleName: b.module?.name ?? null, reopenCount: b.reopenCount, dueAt: b.dueAt, closedAt: firstClose.get(b.id) ?? null, ended: ["INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX", "CLOSED"].includes(b.status) })), from, to);
  const activeCount = live.filter((b) => (ACTIVE_STATUSES as readonly string[]).includes(b.status)).length;
  const runs = await prisma.testRun.findMany({
    where: { projectId: project.id }, orderBy: { createdAt: "desc" }, take: 8,
    select: { name: true, items: { select: { status: true } } },
  });

  const found = foundPerWeek(live.map((b) => b.createdAt), from, to);
  const dm = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
  const sevLegend = SEVERITIES.map((v) => ({ name: SEVERITY_STYLE[v].label, color: RAMP[v] }));
  const stacked = (by: Record<BugSeverity, number>) => SEVERITIES.map((v) => ({ value: by[v], color: RAMP[v], name: SEVERITY_STYLE[v].label }));
  const q = (extra: string) => `/projects/${project.key}?view=all&${extra}${sprint ? `&sprint=${sprint.id}` : ""}${mod ? `&module=${mod.id}` : ""}`;
  const stat = (v: string, l: string) => (
    <div className="bg-surface border border-slate-200 rounded p-4"><div className="text-2xl font-bold text-slate-900">{v}</div><div className="text-xs text-slate-500">{l}</div></div>
  );
  const burn = sprint ? burndown(live.map((b) => ({ createdAt: b.createdAt, closedAt: firstClose.get(b.id) ?? null })), from, to) : null;
  const work = isLead ? workload(live.filter((b) => (ACTIVE_STATUSES as readonly string[]).includes(b.status)).map((b) => ({ severity: b.severity, assignees: b.bugAssignees.map((a) => a.user.name ?? a.user.email) }))) : [];

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="p-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Laporan</h1>
          <form className="flex flex-wrap items-center gap-2 text-xs">
            <input type="hidden" name="tab" value="summary" />
            <label htmlFor="sprint" className="text-slate-600">Periode</label>
            <select id="sprint" name="sprint" defaultValue={sprint?.id ?? ""} className="px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px]">
              <option value="">8 minggu terakhir</option>
              {sprints.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <label htmlFor="module" className="text-slate-600">Modul</label>
            <select id="module" name="module" defaultValue={mod?.id ?? ""} className="px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px]">
              <option value="">Semua modul</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button className="px-3 border border-slate-300 rounded hover:bg-slate-50 min-h-[44px] font-bold">Terapkan</button>
          </form>
          {nav}
        </header>
        <p className="text-xs text-slate-500">{dm.format(from)} – {dm.format(new Date(+to - DAY))} · {sm.total} bug (tanpa Draft)</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stat(String(activeCount), "Bug aktif")}
          {stat(String(t.selesai), "Closed di periode")}
          {stat(String(t.late), "Lewat tenggat/SLA")}
          {stat(`${t.reopenRate}%`, "Reopen rate")}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <BarChart title="Distribusi status bug" note="Ditolak = Invalid, Duplicate, Cannot reproduce, Won't fix. Draft tidak dihitung."
            rows={sm.status.map((x) => ({ label: x.key === "REJECTED" ? "Ditolak" : STATUS_LABEL[x.key], href: x.key === "REJECTED" ? undefined : q(`status=${x.key}`), parts: [{ value: x.count, color: OPEN, name: "Bug" }] }))} />
          <BarChart title="Bug per severity"
            rows={sm.severity.map((x) => ({ label: SEVERITY_STYLE[x.key].label, href: q(`severity=${x.key}`), parts: [{ value: x.count, color: RAMP[x.key], name: "Bug" }] }))} />
          <BarChart title="Passed vs Open per modul" note="Passed = Closed. Open = Open, In progress, Design review, Ready for verification, Reopened."
            legend={[{ name: "Open", color: OPEN }, { name: "Passed", color: PASSED }]}
            rows={sm.modules.map((m) => ({ label: m.name, parts: [{ value: m.open, color: OPEN, name: "Open" }, { value: m.passed, color: PASSED, name: "Passed" }] }))} />
          <BarChart title="Bug terbuka × status" legend={sevLegend}
            rows={sm.openByStatus.map((x) => ({ label: STATUS_LABEL[x.key], href: q(`status=${x.key}`), parts: stacked(x.bySeverity) }))} />
          <BarChart title="Open vs Passed per prioritas" legend={[{ name: "Open", color: OPEN }, { name: "Passed", color: PASSED }]}
            rows={sm.priority.map((x) => ({ label: x.key === "URGENT" ? "Urgent" : x.key === "HIGH" ? "High" : x.key === "NORMAL" ? "Normal" : "Low", parts: [{ value: x.open, color: OPEN, name: "Open" }, { value: x.passed, color: PASSED, name: "Passed" }] }))} />
          <LineChart title="Tren bug ditemukan per minggu" labels={found.map((w) => dm.format(w.start))} series={[{ name: "Ditemukan", color: OPEN, values: found.map((w) => w.count) }]} />
          <BarChart title="Umur bug terbuka" legend={sevLegend}
            rows={sm.age.map((x, i) => ({ label: AGE_BUCKETS[i], parts: stacked(x.bySeverity) }))} />
          {burn ? (
            <LineChart title="Burn-down sprint" labels={burn.map((d) => dm.format(d.day))}
              series={[{ name: "Sisa", color: OPEN, values: burn.map((d) => d.remaining) }, { name: "Ideal", color: "#8F877A", dashed: true, values: burn.map((d) => d.ideal) }]}
              note="Sisa = bug belum Closed. Item test run belum dihitung." />
          ) : (
            <section className="bg-surface border border-slate-200 rounded-lg p-4 text-sm text-slate-600"><h2 className="text-sm font-bold text-slate-900 mb-2">Burn-down sprint</h2>Pilih sebuah sprint di filter Periode untuk melihat burn-down.</section>
          )}
          <BarChart title="Progres eksekusi test run" legend={(Object.keys(TEST_COLOR) as (keyof typeof TEST_COLOR)[]).map((k) => ({ name: TEST_LABEL[k], color: TEST_COLOR[k] }))}
            rows={runs.map((r) => ({ label: r.name, parts: (Object.keys(TEST_COLOR) as (keyof typeof TEST_COLOR)[]).map((k) => ({ value: r.items.filter((i) => i.status === k).length, color: TEST_COLOR[k], name: TEST_LABEL[k] })) }))}
            note="Item Skipped tidak ditampilkan." />
          {isLead && (
            <BarChart title="Workload developer & vendor (bug aktif)" legend={sevLegend} note="Hanya terlihat oleh Admin project. Urut nama, bukan peringkat."
              rows={work.map((w) => ({ label: w.name, parts: stacked(w.bySeverity) }))} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
