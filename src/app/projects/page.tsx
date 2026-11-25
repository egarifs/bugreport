import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { projectOverview, type ProjectFilter } from "@/lib/project-overview";

const TABS: [ProjectFilter, string][] = [["mine", "Saya anggota"], ["all", "Semua"], ["archive", "Arsip"]];
const ROLE: Record<string, string> = { ADMIN: "Admin", QA: "QA", DEVELOPER: "Developer", VENDOR: "Vendor", CLIENT: "Klien", VIEWER: "Viewer" };
const GRID = "grid grid-cols-[minmax(0,1fr)_110px_100px_160px_140px_150px] gap-4 items-center px-5";

function ago(d: Date | null, now = new Date()) {
  if (!d) return "—";
  const m = Math.floor((+now - +d) / 60_000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} jam lalu`;
  return `${Math.floor(m / 1440)} hari lalu`;
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; tests?: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.email || !user.id) redirect("/login");

  const sp = await searchParams;
  const filter: ProjectFilter = sp.f === "all" || sp.f === "archive" ? sp.f : "mine";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const rows = await projectOverview({ id: user.id, isAdmin: Boolean(user.isAdmin) }, filter, q);
  const real = rows.filter((r) => !r.isTest);
  const tests = rows.filter((r) => r.isTest);
  const shown = sp.tests === "1" ? rows : real;
  const href = (o: Record<string, string>) => `/projects?${new URLSearchParams({ f: filter, ...(q ? { q } : {}), ...o })}`;

  const row = (p: (typeof rows)[number]) => (
    <Link key={p.id} href={`/projects/${p.key}`} className={`${GRID} py-4 border-b border-slate-100 text-sm text-slate-900 hover:bg-slate-50`}>
      <span className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-ink text-on-ink flex items-center justify-center font-mono text-[11px]">{p.key.slice(0, 4)}</span>
        <span className="min-w-0"><span className="block font-semibold truncate">{p.name}</span><span className="block text-xs text-slate-500">{p.members} anggota · {p.key}{p.isTest ? " · uji" : ""}</span></span>
      </span>
      <span>{p.role ? ROLE[p.role] : user.isAdmin ? "Admin situs" : "—"}</span>
      <span className="font-mono">{p.active}</span>
      <span className={`flex items-center gap-1.5 font-medium ${p.blockers ? "text-bad" : "text-ok"}`}>
        <span aria-hidden>{p.blockers ? "!" : "✓"}</span>{p.blockers ? `${p.blockers} High/Blocker` : "Siap rilis"}
      </span>
      <span>{p.drafts ? <span className="inline-flex min-w-[22px] h-[22px] px-1.5 rounded-full bg-action text-on-action text-xs font-medium items-center justify-center">{p.drafts}</span> : <span className="text-slate-500">0</span>}</span>
      <span className="text-slate-700">{ago(p.lastActivity)}</span>
    </Link>
  );

  return (
    <AppShell>
      <main className="p-6 md:px-10 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Project</h1>
            <p className="text-sm text-slate-600">Pilih project untuk triase, laporan, atau test run.</p>
          </div>
          {user.isAdmin && <Link href="/projects/new" className="inline-flex items-center h-11 px-4 rounded-lg bg-action hover:bg-action-hover text-on-action text-sm font-semibold">Project baru</Link>}
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Filter project" className="inline-flex p-[3px] gap-0.5 rounded-lg bg-slate-100">
            {TABS.map(([k, l]) => (
              <Link key={k} href={href({ f: k, tests: "" })} aria-current={filter === k ? "page" : undefined} className={`h-[38px] px-3.5 flex items-center rounded-md text-sm ${filter === k ? "bg-surface font-semibold text-slate-900 shadow-xs" : "text-slate-700 font-medium"}`}>{l}</Link>
            ))}
          </nav>
          <form role="search" className="flex-1 min-w-[220px] max-w-[380px]">
            <input type="hidden" name="f" value={filter} />
            <label htmlFor="p-cari" className="sr-only">Cari project</label>
            <input id="p-cari" name="q" type="search" defaultValue={q} placeholder="Cari nama atau kode project" className="w-full h-11 px-3.5 rounded-lg border border-slate-400 bg-surface text-sm" />
          </form>
          <span className="ml-auto text-sm text-slate-600">Urut: aktivitas terakhir</span>
        </div>

        {rows.length === 0 ? (
          <div className="bg-surface border border-slate-200 rounded-lg p-12 text-center">
            <p className="text-sm text-slate-700">{q ? `Tidak ada project untuk “${q}”.` : filter === "archive" ? "Belum ada project di arsip." : "Belum ada project yang di-assign untuk akun Anda."}</p>
            {!q && filter === "mine" && <p className="text-xs text-slate-500 mt-1">Hubungi Administrator untuk mendapatkan akses.</p>}
          </div>
        ) : (
          <div className="bg-surface border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className={`${GRID} py-2.5 bg-slate-50 border-b border-slate-200 text-[13px] font-medium text-slate-600`}>
                  <span>Project</span><span>Peran Anda</span><span>Bug aktif</span><span>Penghalang rilis</span><span>Menunggu review</span><span>Aktivitas terakhir</span>
                </div>
                {shown.map(row)}
                {tests.length > 0 && sp.tests !== "1" && (
                  <Link href={href({ tests: "1" })} className="flex items-center gap-2.5 px-5 min-h-[52px] text-sm text-slate-700 hover:bg-slate-50">
                    <span aria-hidden>›</span><span><b className="text-slate-900">{tests.length} project uji</b> disembunyikan. Tampilkan</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">Project yang dibuat oleh tes otomatis ditandai “uji” dan dilipat supaya daftar kerja tetap bersih.</p>
      </main>
    </AppShell>
  );
}
