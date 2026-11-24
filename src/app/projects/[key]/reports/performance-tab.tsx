import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { METRIC_DEF, periodRange, previousKey } from "@/lib/performance";
import { personMetrics } from "@/lib/performance-service";
import { savePerformanceNote } from "./performance-actions";
import type { ProjectRole } from "@prisma/client";

const QA_ROLES: ProjectRole[] = ["QA"];
const DEV_ROLES: ProjectRole[] = ["DEVELOPER", "VENDOR"];
const input = "px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px] text-sm";

function currentKey(type: "month" | "quarter", now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  return type === "month" ? `${y}-${String(m + 1).padStart(2, "0")}` : `${y}-Q${Math.floor(m / 3) + 1}`;
}

type Row = { id: string; label: string; value: number | string | null; prev: number | string | null; unit?: string };
function Metric({ row }: { row: Row }) {
  const fmt = (v: number | string | null) => (v === null ? "—" : `${typeof v === "number" ? String(Math.round(v * 10) / 10).replace(".", ",") : v}${row.unit ?? ""}`);
  return (
    <div className="bg-surface border border-slate-200 rounded p-4">
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{fmt(row.value)}</div>
      <div className="text-xs text-slate-700 font-bold flex items-center gap-1">{row.label}
        <details className="relative inline"><summary className="cursor-pointer list-none px-1 text-slate-500" aria-label={`Definisi ${row.label}`}>(i)</summary>
          <p className="absolute z-10 mt-1 w-56 p-2 bg-surface border border-slate-300 rounded shadow text-xs font-normal text-slate-700">{METRIC_DEF[row.id]}</p></details>
      </div>
      <div className="text-xs text-slate-500">Periode lalu: {fmt(row.prev)}</div>
    </div>
  );
}

export async function PerformanceTab({ project, userId, isLead, role, targetId, type, pkey, nav }: {
  project: { id: string; key: string }; userId: string; isLead: boolean; role: ProjectRole | null; targetId?: string; type: "month" | "quarter"; pkey?: string; nav: React.ReactNode;
}) {
  const periodKey = pkey && periodRange(type, pkey) ? pkey : currentKey(type);
  const range = periodRange(type, periodKey)!;
  const prevKey = previousKey(type, periodKey)!;
  const prevRange = periodRange(type, prevKey)!;
  // Akses: diri sendiri, atau Admin project untuk orang lain. Orang lain tanpa hak => kembali ke tab Kesiapan rilis.
  const subjectId = targetId && targetId !== userId ? targetId : userId;
  if (subjectId !== userId && !isLead) redirect(`/projects/${project.key}/reports`);
  const member = await prisma.projectMember.findFirst({ where: { projectId: project.id, userId: subjectId }, include: { user: { select: { name: true, email: true } } } });
  const team = isLead ? await prisma.projectMember.findMany({ where: { projectId: project.id }, include: { user: { select: { name: true, email: true } } } }) : [];
  const nameOf = (m: { user: { name: string | null; email: string } }) => m.user.name ?? m.user.email;
  team.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const subjectRole = member?.role ?? role;
  const [cur, prev, note] = member
    ? await Promise.all([
        personMetrics(project.id, subjectId, range.from, range.to), personMetrics(project.id, subjectId, prevRange.from, prevRange.to),
        prisma.performanceNote.findUnique({ where: { projectId_userId_periodType_periodKey: { projectId: project.id, userId: subjectId, periodType: type, periodKey } } }),
      ])
    : [null, null, null];

  const q = (k: keyof NonNullable<typeof cur>["qa"], label: string, unit?: string): Row | null => cur && prev ? { id: k, label, value: cur.qa[k] as number | null, prev: prev.qa[k] as number | null, unit } : null;
  const dv = (k: keyof NonNullable<typeof cur>["dev"], label: string, unit?: string): Row | null => cur && prev ? { id: k, label, value: cur.dev[k] as number | null, prev: prev.dev[k] as number | null, unit } : null;
  const qaRows = [q("casesCreated", "Test case dibuat"), q("newVersions", "Versi baru test case"), q("attemptsManual", "Percobaan manual"), q("attemptsAgent", "Percobaan via agent"), q("reported", "Bug dilaporkan"), q("acceptedPct", "Diterima triase", "%"), q("closed", "Bug ditutup"), q("triageMedianHours", "Median respons triase", " jam"), q("reopenAfterClose", "Reopen setelah ditutup")];
  const devRows = [dv("movedTotal", "Ke Perlu verifikasi"), dv("buildFilledPct", "Build perbaikan terisi", "%"), dv("medianHoursToVerify", "Median ke Perlu verifikasi", " jam"), dv("onTimePct", "Memenuhi tenggat", "%"), dv("reopenRatePct", "Reopen rate", "%"), dv("activeLoad", "Beban aktif"), dv("overdueLoad", "Lewat tenggat")];
  const showQa = subjectRole ? QA_ROLES.includes(subjectRole) : false;
  const showDev = subjectRole ? DEV_ROLES.includes(subjectRole) : false;
  const href = (o: Record<string, string>) => `/projects/${project.key}/reports?${new URLSearchParams({ tab: "performance", type, period: periodKey, ...(subjectId !== userId ? { user: subjectId } : {}), ...o })}`;
  const saveNote = savePerformanceNote.bind(null, project.id, project.key, subjectId, type, periodKey);

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="p-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Laporan</h1>
          <form className="flex items-center gap-2 text-xs">
            <input type="hidden" name="tab" value="performance" />
            {subjectId !== userId && <input type="hidden" name="user" value={subjectId} />}
            <label htmlFor="type" className="text-slate-600">Periode</label>
            <select id="type" name="type" defaultValue={type} className={input}><option value="month">Bulan</option><option value="quarter">Kuartal</option></select>
            <label htmlFor="period" className="sr-only">Kunci periode</label>
            <input id="period" name="period" defaultValue={periodKey} placeholder={type === "month" ? "2026-11" : "2026-Q4"} pattern="\d{4}-(\d{2}|Q[1-4])" className={`${input} w-28`} />
            <button className="px-3 border border-slate-300 rounded hover:bg-slate-50 min-h-[44px] font-bold">Terapkan</button>
          </form>
          {nav}
        </header>

        {isLead && (
          <nav aria-label="Anggota tim" className="flex flex-wrap gap-2 text-sm">
            <span className="text-xs text-slate-500 self-center">Tim (urut nama):</span>
            {team.map((m) => <Link key={m.userId} href={href({ user: m.userId })} aria-current={m.userId === subjectId ? "page" : undefined} className={`px-3 min-h-[44px] flex items-center rounded border font-bold ${m.userId === subjectId ? "border-ink bg-surface text-slate-900" : "border-slate-200 text-slate-600"}`}>{nameOf(m)}</Link>)}
          </nav>
        )}

        {!member ? <p className="text-sm text-slate-600">Orang ini bukan anggota project.</p> : (
          <>
            <p className="text-xs text-slate-500">{subjectId === userId ? "Performa saya" : nameOf(member)} · {subjectRole} · {periodKey}. Pembanding: periode lalu ({prevKey}). Tanpa peringkat antar orang; kerja agent dihitung terpisah.</p>
            {!showQa && !showDev && <p className="text-sm text-slate-600">Metrik performa tersedia untuk peran QA, Developer, dan Vendor.</p>}
            {showQa && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{qaRows.map((r) => r && <Metric key={r.id} row={r} />)}</div>}
            {showDev && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{devRows.map((r) => r && <Metric key={r.id} row={r} />)}</div>}
            <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-bold text-slate-900">Catatan konteks lead</h2>
              {isLead ? (
                <form action={saveNote} className="space-y-2">
                  <label htmlFor="body" className="sr-only">Catatan</label>
                  <textarea id="body" name="body" rows={3} maxLength={2000} defaultValue={note?.body ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded bg-surface text-sm" />
                  <button className="px-3 min-h-[44px] rounded text-sm font-bold border border-slate-300 bg-surface hover:bg-slate-50">Simpan catatan</button>
                </form>
              ) : <p className="text-sm">{note?.body ?? <span className="text-slate-500">Belum ada catatan untuk periode ini.</span>}</p>}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
