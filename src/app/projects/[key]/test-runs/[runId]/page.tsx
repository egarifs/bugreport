import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { StatusBadge } from "@/components/ui/bug-badges";
import {
  closeRunAction, createBugAction, linkBugAction, logAttemptAction, reopenRunAction, updateAllVersionsAction, updateVersionAction,
} from "../test-run-actions";

const GLYPH: Record<string, string> = { NOT_RUN: "○", PASS: "✓", FAIL: "✗", BLOCKED: "◼", SKIPPED: "⊘" };
const LABEL: Record<string, string> = { NOT_RUN: "Belum dijalankan", PASS: "Lolos", FAIL: "Gagal", BLOCKED: "Terblokir", SKIPPED: "Dilewati" };
const DECISION: Record<string, string> = { PASS: "Lolos", PASS_WITH_NOTES: "Lolos dengan catatan", FAIL: "Gagal" };
const wib = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d);
const field = "w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white min-h-[44px]";
const btn = "px-3.5 py-2 min-h-[44px] bg-action hover:bg-action-hover text-white text-sm font-bold rounded duration-fast";
const btnLine = "px-3.5 py-2 min-h-[44px] border border-slate-300 text-slate-700 text-sm font-bold rounded hover:bg-slate-50 duration-fast";

export default async function TestRunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; runId: string }>;
  searchParams: Promise<{ item?: string; filter?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key, runId } = await params;
  const sp = await searchParams;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, include: { members: { where: { userId: user.id } } } });
  if (!project) notFound();
  const role = project.members[0]?.role ?? null;
  if (!role && !user.isAdmin) redirect("/projects");
  if (!hasPermission(role, "testcase.read", user.isAdmin)) redirect(`/projects/${project.key}`);

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    include: {
      closedBy: { select: { name: true, email: true } },
      items: {
        orderBy: { testCase: { code: "asc" } },
        include: {
          testCase: { select: { code: true, title: true, steps: true, expectedResult: true, module: { select: { name: true } }, moduleArea: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, version: true } } } },
          testCaseVersion: { select: { version: true } },
          rerunBug: { select: { key: true, number: true } },
          bugLinks: { include: { bug: { select: { key: true, number: true, status: true } } } },
          attempts: { orderBy: { seq: "asc" }, include: { executedBy: { select: { name: true, email: true } }, testCaseVersion: { select: { version: true } } } },
        },
      },
    },
  });
  if (!run || run.projectId !== project.id) notFound();

  const canExecute = hasPermission(role, "testrun.execute", user.isAdmin);
  const canCreateBug = hasPermission(role, "bug.create", user.isAdmin);
  const canReopen = hasPermission(role, "testcase.manage", user.isAdmin);
  const open = run.status === "IN_PROGRESS";
  const pid = project.id;
  const base = `/projects/${project.key}/test-runs/${run.id}`;

  const count = (s: string) => run.items.filter((i) => i.status === s).length;
  const total = run.items.length;
  const rerunCount = run.items.filter((i) => i.needsRerun).length;
  const newer = (i: (typeof run.items)[number]) => {
    const latest = i.testCase.versions[0];
    return latest && latest.id !== i.testCaseVersionId ? latest.version : null;
  };
  const staleCount = run.items.filter((i) => newer(i)).length;
  const visible = sp.filter === "rerun" ? run.items.filter((i) => i.needsRerun) : run.items;
  const selected = run.items.find((i) => i.id === sp.item) ?? visible[0] ?? null;
  const pending = run.items.filter((i) => i.status === "NOT_RUN");
  const href = (extra: string) => `${base}?${extra}`;

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center gap-3">
          <Link href={`/projects/${project.key}/test-cases`} className="text-sm text-slate-500 hover:text-slate-900">← Test Runs</Link>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <h1 className="font-bold text-slate-900 text-sm">{run.name}</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">{run.environment}</span>
          {run.buildVersion && <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">{run.buildVersion}</span>}
          <span className={`text-xs px-2 py-0.5 rounded border ${open ? "border-slate-200 text-slate-600" : "border-slate-700 text-slate-900 font-bold"}`}>
            {open ? "Berjalan" : `Ditutup · ${run.decision ? DECISION[run.decision] : ""}`}
          </span>
          <div className="ml-auto flex gap-2">
            {open && canExecute && staleCount > 0 && (
              <ActionForm action={updateAllVersionsAction.bind(null, pid, run.id)}>
                <SubmitButton pendingText="Memperbarui..." className={btnLine}>Perbarui semua ke versi baru ({staleCount})</SubmitButton>
              </ActionForm>
            )}
            {!open && canReopen && (
              <ActionForm action={reopenRunAction.bind(null, pid, run.id)}>
                <SubmitButton pendingText="Membuka..." className={btnLine}>Buka kembali</SubmitButton>
              </ActionForm>
            )}
          </div>
        </header>

        <main className="p-6 space-y-4 flex-1">
          <section aria-label="Ringkasan" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-700">
            <span className="font-bold text-slate-900">{total} test case</span>
            {["PASS", "FAIL", "BLOCKED", "SKIPPED", "NOT_RUN"].map((s) => (
              <span key={s}><span aria-hidden="true">{GLYPH[s]}</span> {LABEL[s]} <b>{count(s)}</b></span>
            ))}
            <Link href={href(sp.filter === "rerun" ? "" : "filter=rerun")} aria-current={sp.filter === "rerun" ? "true" : undefined}
              className={`px-2 py-1 rounded border text-xs ${sp.filter === "rerun" ? "border-slate-700 font-bold" : "border-slate-200"}`}>
              Perlu re-run ({rerunCount})
            </Link>
          </section>

          {!open && run.decisionNote && (
            <p className="text-sm bg-slate-50 border border-slate-200 rounded p-3">
              <b>{run.decision && DECISION[run.decision]}</b> oleh {run.closedBy?.name || run.closedBy?.email}: {run.decisionNote}
            </p>
          )}

          <div className="grid lg:grid-cols-[304px_1fr] gap-4 items-start">
            <nav aria-label="Daftar test case" className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
              {visible.length === 0 && <p className="p-4 text-sm text-slate-500">Tidak ada item yang perlu re-run.</p>}
              {visible.map((i) => (
                <Link key={i.id} href={href(`item=${i.id}${sp.filter ? `&filter=${sp.filter}` : ""}`)} aria-current={selected?.id === i.id ? "true" : undefined}
                  className={`flex items-start gap-2 px-3 py-2 min-h-[44px] hover:bg-slate-50 duration-fast ${selected?.id === i.id ? "bg-slate-100" : ""}`}>
                  <span aria-hidden="true" className="mt-0.5 w-4 text-center">{GLYPH[i.status]}</span>
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-slate-600">{i.testCase.code}</span>
                    <span className="block text-sm text-slate-900 truncate">{i.testCase.title}</span>
                    <span className="text-xs text-slate-500">{LABEL[i.status]}{i.attempts.length > 1 ? ` · ${i.attempts.length} percobaan` : ""}</span>
                    {i.needsRerun && <span className="block text-xs font-bold text-sev-high">Perlu re-run</span>}
                    {newer(i) && <span className="block text-xs font-bold text-action">Ada versi baru (v{newer(i)})</span>}
                  </span>
                </Link>
              ))}
            </nav>

            {selected && (
              <article aria-label={`Detail ${selected.testCase.code}`} className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
                <header>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{selected.testCase.code}</span> · v{selected.testCaseVersion?.version ?? "?"}
                    {(selected.testCase.module?.name ?? selected.testCase.moduleArea) && ` · ${selected.testCase.module?.name ?? selected.testCase.moduleArea}`}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">{selected.testCase.title}</h2>
                  {selected.needsRerun && (
                    <p className="mt-2 text-sm border border-sev-high rounded px-3 py-2 bg-sev-high-bg text-sev-high">
                      <b>Perlu re-run{selected.rerunBuild ? ` di build ${selected.rerunBuild}` : ""}</b>
                      {selected.rerunBug && <> — <Link className="underline" href={`/projects/${project.key}/bugs/${selected.rerunBug.number}`}>{selected.rerunBug.key}</Link> siap diverifikasi.</>}
                    </p>
                  )}
                  {newer(selected) && open && canExecute && (
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <span className="font-bold text-action">Ada versi baru (v{newer(selected)})</span>
                      <ActionForm action={updateVersionAction.bind(null, pid, selected.id)}>
                        <SubmitButton pendingText="Memperbarui..." className={btnLine}>Perbarui ke v{newer(selected)}</SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                </header>

                <section className="text-sm space-y-2">
                  <h3 className="font-bold text-slate-900">Langkah</h3>
                  <p className="whitespace-pre-line text-slate-700">{selected.testCase.steps}</p>
                  <h3 className="font-bold text-slate-900">Hasil yang diharapkan</h3>
                  <p className="text-slate-700">{selected.testCase.expectedResult}</p>
                </section>

                <section aria-label="Bug terkait" className="text-sm">
                  <h3 className="font-bold text-slate-900 mb-1">Bug terkait</h3>
                  {selected.bugLinks.length === 0 && <p className="text-slate-500">Belum ada bug.</p>}
                  <ul className="flex flex-wrap gap-2">
                    {selected.bugLinks.map((l) => (
                      <li key={l.bugId}>
                        <Link href={`/projects/${project.key}/bugs/${l.bug.number}`} className="inline-flex items-center gap-2 px-2 py-1 border border-slate-200 rounded hover:bg-slate-50">
                          <span className="font-mono">{l.bug.key}</span><StatusBadge status={l.bug.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {open && canExecute && (
                    <div className="mt-3 flex flex-wrap items-start gap-3">
                      {canCreateBug && selected.status === "FAIL" && (
                        <ActionForm action={createBugAction.bind(null, pid, selected.id)}>
                          <SubmitButton pendingText="Membuat..." className={btn}>Buat bug baru</SubmitButton>
                        </ActionForm>
                      )}
                      <ActionForm action={linkBugAction.bind(null, pid, selected.id)} className="flex items-end gap-2">
                        <div>
                          <label htmlFor="bugKey" className="block text-xs font-bold text-slate-700 mb-1">Tautkan bug yang ada</label>
                          <input id="bugKey" name="bugKey" required placeholder={`${project.key}-12`} className={`${field} w-40`} />
                        </div>
                        <SubmitButton pendingText="Menautkan..." className={btnLine}>Tautkan</SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                </section>

                <section aria-label="Log percobaan">
                  <h3 className="font-bold text-slate-900 text-sm mb-2">Log percobaan ({selected.attempts.length})</h3>
                  {selected.attempts.length === 0 && <p className="text-sm text-slate-500">Belum ada percobaan.</p>}
                  <ol className="space-y-2">
                    {selected.attempts.map((a) => (
                      <li key={a.id} className="border border-slate-200 rounded p-3 text-sm">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <b>#{a.seq} <span aria-hidden="true">{GLYPH[a.result]}</span> {LABEL[a.result]}</b>
                          <span className="text-slate-500">{wib(a.createdAt)} WIB</span>
                          <span className="text-slate-500">{a.executedBy?.name || a.executedBy?.email || "—"}{a.viaAgent ? " · via agent" : ""}</span>
                          <span className="font-mono text-xs text-slate-500">{[a.build, a.environment].filter(Boolean).join(" · ")}{a.testCaseVersion ? ` · v${a.testCaseVersion.version}` : ""}</span>
                        </p>
                        {a.actualResult && <p className="mt-1 text-slate-700">Aktual: {a.actualResult}</p>}
                        {a.notes && <p className="mt-1 text-slate-700">{a.result === "SKIPPED" ? "Alasan" : "Catatan"}: {a.notes}</p>}
                        {a.evidenceUrl && <p className="mt-1"><a className="underline text-action break-all" href={a.evidenceUrl} target="_blank" rel="noopener noreferrer">Bukti</a></p>}
                      </li>
                    ))}
                  </ol>
                </section>

                {open && canExecute && (
                  <section aria-label="Catat percobaan" className="border-t border-slate-100 pt-4">
                    <h3 className="font-bold text-slate-900 text-sm mb-2">Catat percobaan baru</h3>
                    <ActionForm action={logAttemptAction.bind(null, pid, selected.id)} className="space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="result" className="block text-xs font-bold text-slate-700 mb-1">Hasil</label>
                          <select id="result" name="result" defaultValue="PASS" className={field}>
                            <option value="PASS">Lolos</option><option value="FAIL">Gagal</option>
                            <option value="BLOCKED">Terblokir</option><option value="SKIPPED">Dilewati</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="build" className="block text-xs font-bold text-slate-700 mb-1">Build yang dites</label>
                          <input id="build" name="build" defaultValue={selected.rerunBuild ?? run.buildVersion ?? ""} className={field} />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="actualResult" className="block text-xs font-bold text-slate-700 mb-1">Hasil aktual (wajib bila Gagal)</label>
                        <textarea id="actualResult" name="actualResult" rows={2} className={field} />
                      </div>
                      <div>
                        <label htmlFor="evidenceUrl" className="block text-xs font-bold text-slate-700 mb-1">Link bukti (wajib bila Gagal)</label>
                        <input id="evidenceUrl" name="evidenceUrl" type="url" placeholder="https://" className={field} />
                      </div>
                      <div>
                        <label htmlFor="notes" className="block text-xs font-bold text-slate-700 mb-1">Catatan (alasan wajib bila Dilewati)</label>
                        <input id="notes" name="notes" className={field} />
                      </div>
                      <SubmitButton pendingText="Menyimpan..." className={btn}>Simpan percobaan</SubmitButton>
                    </ActionForm>
                  </section>
                )}
              </article>
            )}
          </div>

          {open && canExecute && (
            <details className="bg-white border border-slate-200 rounded-lg p-4" open={sp.filter === "close"}>
              <summary className="cursor-pointer font-bold text-sm text-slate-900 min-h-[44px] flex items-center">Tutup test run</summary>
              <ActionForm action={closeRunAction.bind(null, pid, run.id)} className="space-y-4 mt-2">
                {pending.length > 0 && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-bold text-slate-900">{pending.length} item belum dijalankan. Tentukan nasibnya:</legend>
                    {pending.map((i) => (
                      <div key={i.id} className="grid sm:grid-cols-[1fr_160px_1fr] gap-2 items-end">
                        <p className="text-sm"><span className="font-mono text-xs">{i.testCase.code}</span> {i.testCase.title}</p>
                        <div>
                          <label htmlFor={`res_${i.id}`} className="block text-xs font-bold text-slate-700 mb-1">Jadikan</label>
                          <select id={`res_${i.id}`} name={`res_${i.id}`} defaultValue="SKIPPED" className={field}>
                            <option value="SKIPPED">Dilewati</option><option value="BLOCKED">Terblokir</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`reason_${i.id}`} className="block text-xs font-bold text-slate-700 mb-1">Alasan</label>
                          <input id={`reason_${i.id}`} name={`reason_${i.id}`} className={field} />
                        </div>
                      </div>
                    ))}
                  </fieldset>
                )}
                <div className="grid sm:grid-cols-[220px_1fr] gap-3">
                  <div>
                    <label htmlFor="decision" className="block text-xs font-bold text-slate-700 mb-1">Keputusan</label>
                    <select id="decision" name="decision" defaultValue="" required className={field}>
                      <option value="" disabled>Pilih…</option>
                      <option value="PASS">Lolos</option><option value="PASS_WITH_NOTES">Lolos dengan catatan</option><option value="FAIL">Gagal</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="note" className="block text-xs font-bold text-slate-700 mb-1">Catatan (wajib bila bukan Lolos)</label>
                    <input id="note" name="note" className={field} />
                  </div>
                </div>
                <SubmitButton pendingText="Menutup..." className={btn}>Tutup run</SubmitButton>
              </ActionForm>
            </details>
          )}
        </main>
      </div>
    </AppShell>
  );
}
