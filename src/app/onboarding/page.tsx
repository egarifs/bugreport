import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { FEATURES, GLOSSARY, GUIDE_ROLES, GUIDE_ROLE_HINT, GUIDE_ROLE_LABEL, progressOf } from "@/lib/onboarding";
import { syncProgress } from "@/lib/onboarding-service";
import { chooseGuideRole, openSandbox, resetMySandbox } from "./actions";

const TABS = [["role", "Untuk peran saya"], ["all", "Semua fitur"], ["flow", "Alur bug"], ["glossary", "Kamus istilah"]] as const;
const btn = "px-4 min-h-[44px] rounded-lg text-sm font-bold border border-slate-300 bg-surface hover:bg-slate-50";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!me || (me.status !== "ACTIVE" && me.status !== "PENDING")) redirect("/pending");
  const { tab = "role" } = await searchParams;
  const { guideRole, completed } = await syncProgress(userId);
  const sandbox = await prisma.project.findUnique({ where: { sandboxOwnerId: userId }, select: { key: true } });
  const pending = me.status === "PENDING";

  const body = (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Panduan</h1>
          <p className="text-sm text-slate-600">Berlatih di Project Latihan dengan data contoh. Aman dicoba, dan bisa direset kapan saja.</p>
        </div>
        <div className="flex gap-2">
          <form action={openSandbox}><button className={`${btn} bg-ink text-on-ink border-ink hover:bg-ink-hover`}>{sandbox ? "Buka project Latihan" : "Mulai berlatih"}</button></form>
          {pending && <Link href="/pending" className={`${btn} flex items-center`}>Status persetujuan</Link>}
        </div>
      </header>

      {!guideRole ? (
        <section aria-labelledby="pick" className="space-y-3">
          <h2 id="pick" className="text-base font-bold text-slate-900">Pilih peran panduan</h2>
          <p className="text-xs text-slate-500">Pilihan ini hanya memengaruhi isi panduan, bukan hak akses. Setelah disetujui, peran dari Admin yang berlaku.</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDE_ROLES.map((r) => (
              <li key={r}>
                <form action={chooseGuideRole} className="h-full">
                  <input type="hidden" name="role" value={r} />
                  <button className="w-full h-full text-left bg-surface border border-slate-200 rounded-lg p-4 hover:border-slate-400 min-h-[44px]">
                    <span className="block font-bold text-slate-900">{GUIDE_ROLE_LABEL[r]}</span>
                    <span className="block text-xs text-slate-600 mt-1">{GUIDE_ROLE_HINT[r]}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <nav aria-label="Bagian panduan" className="flex flex-wrap gap-2 border-b border-slate-200">
            {TABS.map(([k, l]) => (
              <Link key={k} href={`/onboarding?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`px-3 min-h-[44px] flex items-center text-sm font-bold border-b-2 ${tab === k ? "border-ink text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{l}</Link>
            ))}
          </nav>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section>
              {tab === "all" && (
                <ul className="grid gap-3 sm:grid-cols-2">{FEATURES.map((f) => (
                  <li key={f.title} className="bg-surface border border-slate-200 rounded-lg p-4"><h3 className="font-bold text-slate-900">{f.title}</h3><p className="text-sm text-slate-600 mt-1">Kapan dipakai: {f.when}</p></li>
                ))}</ul>
              )}
              {tab === "flow" && (
                <ol className="space-y-2 text-sm">{["Draft: laporan baru menunggu triase", "Open: diterima dan siap dikerjakan", "In progress: sedang dikerjakan", "Perlu verifikasi: perbaikan selesai di sebuah build", "Closed: lolos verifikasi QA (atau Reopened bila gagal)"].map((s, i) => (
                  <li key={s} className="bg-surface border border-slate-200 rounded-lg p-3"><b>{i + 1}.</b> {s}</li>
                ))}</ol>
              )}
              {tab === "glossary" && (
                <dl className="space-y-2">{GLOSSARY.map((g) => <div key={g.term} className="bg-surface border border-slate-200 rounded-lg p-3"><dt className="font-bold text-slate-900">{g.term}</dt><dd className="text-sm text-slate-600">{g.meaning}</dd></div>)}</dl>
              )}
              {tab === "role" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">Peran panduan: <b>{GUIDE_ROLE_LABEL[guideRole]}</b>. {GUIDE_ROLE_HINT[guideRole]}</p>
                  <form action={chooseGuideRole} className="flex items-center gap-2 text-xs">
                    <label htmlFor="role" className="text-slate-600">Ganti peran panduan</label>
                    <select id="role" name="role" defaultValue={guideRole} className="px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px]">{GUIDE_ROLES.map((r) => <option key={r} value={r}>{GUIDE_ROLE_LABEL[r]}</option>)}</select>
                    <button className="px-3 border border-slate-300 rounded hover:bg-slate-50 min-h-[44px] font-bold">Simpan</button>
                  </form>
                </div>
              )}
            </section>
            <aside aria-label="Langkah pertama" className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3 h-fit">
              {(() => {
                const p = progressOf(guideRole, completed);
                return (
                  <>
                    <h2 className="text-sm font-bold text-slate-900">Langkah pertama · {p.done} / {p.total}</h2>
                    <div className="h-1.5 rounded bg-slate-100" role="progressbar" aria-valuenow={p.done} aria-valuemin={0} aria-valuemax={p.total}><div className="h-full rounded bg-ink" style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
                    <ul className="space-y-2 text-sm">{p.steps.map((s) => (
                      <li key={s.event}><span aria-hidden>{s.ok ? "✓" : "○"}</span> <span className="sr-only">{s.ok ? "Selesai:" : "Belum:"}</span><b>{s.title}</b><span className="block text-xs text-slate-500">{s.hint}</span></li>
                    ))}</ul>
                    <p className="text-xs text-slate-500">Langkah tercentang otomatis saat Anda melakukannya di project Latihan.</p>
                  </>
                );
              })()}
              {sandbox && <form action={resetMySandbox}><button className="text-xs underline min-h-[32px]">Reset data Latihan</button></form>}
            </aside>
          </div>
        </>
      )}
    </main>
  );
  return pending ? <div className="min-h-screen bg-slate-50">{body}</div> : <AppShell>{body}</AppShell>;
}
