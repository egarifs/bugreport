import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { buildReleaseNotes, exitStatus } from "@/lib/stlc";
import { exitFacts, releaseBugs, summaryData, type SummaryData } from "@/lib/stlc-service";
import { STATUS_LABEL_STLC } from "@/lib/stlc-labels";
import { approveStlcDoc, finalizeStlcDoc, saveStlcDoc } from "../stlc-actions";

const btn = "px-3 min-h-[44px] rounded text-sm font-bold border border-slate-300 bg-surface hover:bg-slate-50 disabled:opacity-50";
const area = "w-full px-3 py-2 border border-slate-300 rounded bg-surface text-sm disabled:bg-slate-50";
const PLAN_FIELDS = [["scope", "1. Ruang lingkup"], ["approach", "2. Pendekatan"], ["environment", "3. Lingkungan & data"], ["entry", "4a. Kriteria masuk"], ["exit", "4b. Kriteria keluar"], ["risk", "5. Risiko"], ["schedule", "6. Jadwal & peran"]] as const;

export default async function StlcDocPage({ params, searchParams }: { params: Promise<{ key: string; id: string }>; searchParams: Promise<{ view?: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const { key, id } = await params;
  const { view } = await searchParams;
  const doc = await prisma.stlcDoc.findUnique({ where: { id }, include: { project: { select: { key: true } }, sprint: true } });
  if (!doc || doc.project.key !== key.toUpperCase()) notFound();
  let actor;
  try { actor = await checkProjectPermission(userId, doc.projectId, "doc.read"); } catch { redirect("/projects"); }
  const canManage = hasPermission(actor.role, "doc.manage", actor.isAdmin);
  const canApprove = hasPermission(actor.role, "doc.approve", actor.isAdmin);
  const body = doc.body as Record<string, string | Record<string, string>>;
  const text = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const locked = doc.status === "FINAL" || !canManage;
  const save = saveStlcDoc.bind(null, id);

  let content: React.ReactNode = null;
  if (doc.kind === "TEST_PLAN") {
    const ex = exitStatus(await exitFacts(doc.projectId));
    content = (
      <>
        {PLAN_FIELDS.map(([k, label]) => (
          <div key={k}><label htmlFor={k} className="block text-sm font-bold text-slate-900 mb-1">{label}</label><textarea id={k} name={k} rows={3} defaultValue={text(k)} disabled={locked} className={area} /></div>
        ))}
        <section aria-label="Kriteria keluar" className="bg-surface border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Kriteria keluar · status saat ini</h2>
          <ul className="text-sm space-y-1">{ex.map((e) => <li key={e.text}><span aria-hidden>{e.ok ? "✓" : "✕"}</span> <span className="sr-only">{e.ok ? "Terpenuhi:" : "Belum:"}</span>{e.text}</li>)}</ul>
          <p className="text-xs text-slate-500 mt-2">Informatif: tampil juga di Kesiapan rilis dan tidak memblokir rilis.</p>
        </section>
      </>
    );
  } else if (doc.kind === "TEST_SUMMARY") {
    const d = (doc.snapshot as SummaryData | null) ?? (doc.sprint ? await summaryData(doc.projectId, doc.sprint) : null);
    content = d && (
      <>
        <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
          <p className="text-xs text-slate-500">{doc.status === "FINAL" ? "Angka dibekukan" : "Terisi otomatis"} · data per {new Date(d.asOf).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
          <h2 className="font-bold text-slate-900">1. Ringkasan</h2>
          <p>{d.attempts} percobaan di {d.runs.length} test run. Cakupan requirement {d.coverage.sections ? Math.round((d.coverage.withTestCase / d.coverage.sections) * 100) : "—"}% ({d.coverage.withTestCase} dari {d.coverage.sections} bagian punya test case). {d.bugs.closed} bug ditutup, {d.bugs.active} masih aktif ({d.bugs.activeHigh} High/Blocker).</p>
          <h2 className="font-bold text-slate-900">2. Hasil eksekusi</h2>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-xs text-slate-600"><tr>{["Test run", "Lolos", "Gagal", "Terblokir", "Keputusan"].map((h) => <th key={h} scope="col" className="py-1 pr-3 font-bold">{h}</th>)}</tr></thead>
            <tbody>{d.runs.map((r) => <tr key={r.name} className="border-t border-slate-100"><td className="py-1 pr-3">{r.name}</td><td className="pr-3 tabular-nums">{r.pass}</td><td className="pr-3 tabular-nums">{r.fail}</td><td className="pr-3 tabular-nums">{r.blocked}</td><td>{r.decision === "PASS" ? "Lolos" : r.decision === "PASS_WITH_NOTES" ? "Lolos bersyarat" : r.decision === "FAIL" ? "Gagal" : "Belum diputuskan"}</td></tr>)}
            {!d.runs.length && <tr><td colSpan={5} className="py-2 text-slate-500">Tidak ada test run di periode sprint.</td></tr>}</tbody></table></div>
          <h2 className="font-bold text-slate-900">3. Bug</h2>
          <p>Masuk {d.bugs.total} · ditutup {d.bugs.closed} · pernah dibuka ulang {d.bugs.reopened}.</p>
        </section>
        <div><label htmlFor="deviations" className="block text-sm font-bold text-slate-900 mb-1">4. Penyimpangan dari Test Plan</label><textarea id="deviations" name="deviations" rows={3} defaultValue={text("deviations") || (d.coverage.noTestCase.length ? `Bagian tanpa test case: ${d.coverage.noTestCase.join(", ")}.` : "")} disabled={locked} className={area} /></div>
        <div><label htmlFor="recommendation" className="block text-sm font-bold text-slate-900 mb-1">5. Rekomendasi</label><textarea id="recommendation" name="recommendation" rows={3} defaultValue={text("recommendation")} disabled={locked} className={area} /></div>
      </>
    );
  } else {
    const external = view === "external";
    const version = doc.releaseVersion ?? "";
    const notes = buildReleaseNotes(await releaseBugs(doc.projectId), version, (body.titles as Record<string, string>) ?? {}, external);
    const titles = (body.titles as Record<string, string>) ?? {};
    const list = (items: typeof notes.fixes, editable: boolean) => (
      <ul className="space-y-2 text-sm">{items.map((i) => (
        <li key={i.key}>{editable && !locked ? (<><label htmlFor={`t-${i.key}`} className="sr-only">Judul untuk pengguna {i.key}</label><input id={`t-${i.key}`} name={`title:${i.key}`} defaultValue={titles[i.key] ?? i.text} maxLength={200} className={`${area}`} /></>) : i.text}{i.meta && <span className="block text-xs text-slate-500">{i.meta}</span>}</li>
      ))}{!items.length && <li className="text-slate-500">Tidak ada.</li>}</ul>
    );
    content = (
      <>
        <nav aria-label="Versi" className="flex gap-2 text-sm">{(["internal", "external"] as const).map((v) => <Link key={v} href={`?view=${v}`} aria-current={(external ? "external" : "internal") === v ? "page" : undefined} className={`px-3 min-h-[44px] flex items-center rounded border font-bold ${(external ? "external" : "internal") === v ? "border-ink bg-surface text-slate-900" : "border-slate-200 text-slate-600"}`}>{v === "internal" ? "Internal" : "Eksternal"}</Link>)}</nav>
        <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3"><h2 className="text-sm font-bold text-slate-900">Perbaikan</h2>{list(notes.fixes, external)}<h2 className="text-sm font-bold text-slate-900">Masalah yang diketahui</h2>{list(notes.known, false)}</section>
        <p className="text-xs text-slate-500">Dibuat dari bug Closed dengan “Diperbaiki di” = {version}. Versi eksternal: judul ditulis ulang untuk pengguna (bisa disunting), tanpa nama orang, catatan internal, atau Draft/Invalid. Versi internal menampilkan ID, severity, dan penanggung jawab.</p>
      </>
    );
  }

  return (
    <AppShell activeProjectKey={doc.project.key}>
      <div className="p-6 max-w-3xl space-y-5">
        <nav className="text-xs"><Link className="underline" href={`/projects/${doc.project.key}/stlc`}>← Rencana uji & laporan</Link></nav>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-lg font-semibold text-slate-900">{doc.title}</h1><p className="text-xs text-slate-500">{STATUS_LABEL_STLC[doc.kind][doc.status]}{doc.releaseVersion ? ` · rilis ${doc.releaseVersion}` : ""}{doc.sprint ? ` · ${doc.sprint.name}` : ""}</p></div>
          <div className="flex gap-2">
            {doc.kind === "TEST_PLAN" && canApprove && doc.status === "DRAFT" && <form action={approveStlcDoc.bind(null, id)}><button className={btn}>Setujui</button></form>}
            {doc.kind !== "TEST_PLAN" && canManage && doc.status !== "FINAL" && <form action={finalizeStlcDoc.bind(null, id)}><button className={btn}>Finalkan</button></form>}
          </div>
        </header>
        <form action={save} className="space-y-5">
          {content}
          {!locked && <button className={btn}>Simpan</button>}
        </form>
      </div>
    </AppShell>
  );
}
