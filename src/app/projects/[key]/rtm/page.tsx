import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { AppShell } from "@/components/layout/app-shell";
import { loadRtm } from "@/lib/requirement-service";
import { COVERAGE_LABEL, REQ_STATUS_LABEL } from "@/lib/requirement-labels";

const FILTERS = [["all", "Semua"], ["unsafe", "Belum aman"], ["NO_TC", "Tanpa TC"]] as const;

export default async function RtmPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ doc?: string; f?: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const { key } = await params;
  const { doc: docSlug, f = "all" } = await searchParams;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, select: { id: true, key: true } });
  if (!project) notFound();
  try { await checkProjectPermission(userId, project.id, "doc.read"); } catch { redirect("/projects"); }

  const docs = await prisma.businessDoc.findMany({ where: { projectId: project.id }, orderBy: { title: "asc" }, select: { id: true, slug: true, title: true } });
  const doc = docs.find((d) => d.slug === docSlug) ?? docs[0];
  const rtm = doc ? await loadRtm(project.id, project.key, doc.id) : null;
  const rows = rtm?.rows ?? [];
  const n = (c: string) => rows.filter((r) => r.coverage === c).length;
  const withTc = rows.filter((r) => r.cases.length).length;
  const shown = rows.filter((r) => f === "all" || (f === "unsafe" ? r.coverage !== "VERIFIED" : r.coverage === f));
  const card = (v: string, l: string, sub?: string) => (
    <div className="bg-surface border border-slate-200 rounded p-4"><div className="text-2xl font-bold text-slate-900">{v}</div><div className="text-xs text-slate-700 font-bold">{l}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</div>
  );
  const href = (extra: Record<string, string>) => `/projects/${project.key}/rtm?${new URLSearchParams({ ...(doc ? { doc: doc.slug } : {}), ...extra })}`;

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="p-6 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Matriks keterlacakan (RTM)</h1>
            <p className="text-xs text-slate-500">Requirement → test case → hasil terakhir → bug. Dihitung otomatis.{rtm && ` ${rtm.doc.title} · v${rtm.version.versionNum}`}</p>
          </div>
          <div className="flex items-center gap-2">
            {docs.length > 1 && (
              <form className="flex items-center gap-2 text-xs">
                <label htmlFor="doc" className="text-slate-600">Dokumen</label>
                <select id="doc" name="doc" defaultValue={doc?.slug} className="px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px]">{docs.map((d) => <option key={d.id} value={d.slug}>{d.title}</option>)}</select>
                <button className="px-3 border border-slate-300 rounded hover:bg-slate-50 min-h-[44px] font-bold">Buka</button>
              </form>
            )}
            {doc && <a href={`/api/projects/${project.key}/rtm?doc=${doc.slug}`} className="px-3 min-h-[44px] flex items-center text-sm font-bold rounded bg-surface border border-slate-300 hover:bg-slate-50">CSV</a>}
          </div>
        </header>

        {!rtm ? (
          <p className="text-sm text-slate-600">Belum ada dokumen requirement yang disetujui. <Link className="underline" href={`/projects/${project.key}/docs`}>Buka Dokumen</Link></p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {card(rows.length ? `${Math.round((withTc / rows.length) * 100)}%` : "—", "Cakupan requirement", `${withTc} dari ${rows.length} bagian punya test case`)}
              {card(`${n("VERIFIED")} / ${rows.length}`, "Terverifikasi", "lolos semua TC + tanpa bug terbuka")}
              {card(String(n("FAILED")), "Gagal")}
              {card(String(n("NO_TC")), "Tanpa test case")}
            </div>
            <nav aria-label="Filter" className="flex gap-2 text-sm">
              {FILTERS.map(([k, l]) => (
                <Link key={k} href={href({ f: k })} aria-current={f === k ? "page" : undefined} className={`px-3 min-h-[44px] flex items-center rounded border font-bold ${f === k ? "border-ink text-slate-900 bg-surface" : "border-slate-200 text-slate-600"}`}>{l}</Link>
              ))}
            </nav>
            <div className="overflow-x-auto bg-surface border border-slate-200 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-600"><tr>{["Bagian", "Status req.", "Test case", "Hasil terakhir", "Bug terbuka", "Status cakupan"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-3 py-2"><Link className="font-bold text-slate-900 underline-offset-2 hover:underline" href={`/projects/${project.key}/rtm/${r.id}`}>{r.title}</Link></td>
                      <td className="px-3 py-2">{REQ_STATUS_LABEL[r.status]}</td>
                      <td className="px-3 py-2 tabular-nums">{r.cases.length}</td>
                      <td className="px-3 py-2">{!r.cases.length ? "—" : r.cases.every((c) => c.result === "NOT_RUN") ? "Belum dijalankan" : `Lolos ${r.passed}/${r.cases.length}`}</td>
                      <td className="px-3 py-2">{r.openBugs.length ? r.openBugs.map((b) => <Link key={b.key} className="underline mr-1" href={`/projects/${project.key}/bugs/${b.number}`}>{b.key}</Link>) : "—"}</td>
                      <td className="px-3 py-2 font-bold">{COVERAGE_LABEL[r.coverage]}</td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Tidak ada bagian untuk filter ini.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Klik bagian untuk mengatur kriteria, modul, test case, dan status. Ekspor CSV menyertakan versi dokumen dan waktu cetak.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
