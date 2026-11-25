import { activeModules } from "@/lib/modules";
import { hasPermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BugPriority, BugSeverity } from "@prisma/client";
import { DEFAULT_SEVERITY } from "@/lib/bug-create-service";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DuplicateChecker } from "./duplicate-checker";
import { DraftAutosave } from "./draft-autosave";
import { ScreenshotInput } from "./screenshot-input";
import { QuickBugForm } from "./quick-bug-form";
import { createBugAction } from "./actions";

const LABEL = "block font-bold text-slate-700 mb-1";
const INPUT = "w-full px-3 py-2 border border-slate-300 rounded bg-surface focus:outline-none focus:ring-2 focus:ring-action";
const TEXTAREA = `${INPUT} resize-y min-h-20`;
const HINT = "mt-1 text-xs text-slate-500";
const SUMMARY = "cursor-pointer font-semibold text-slate-700 select-none";

// Fast logging: only the title is visible. Severity defaults to Medium, module can be filled in at triage.
export default async function NewBugPage({ params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.email || !user.id) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, include: { members: { where: { userId: user.id } } } });
  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");

  const role = project.members[0]?.role;
  const modules = await activeModules(project.id);
  const canReview = hasPermission(role, "bug.review", user.isAdmin);

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-surface border-b border-slate-200 px-6 py-4 flex items-center gap-3">
          <Link href={`/projects/${project.key}`} className="text-sm text-slate-500 hover:text-slate-900">← Kembali ke {project.key}</Link>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 text-sm">Laporkan Bug Baru</span>
        </header>

        <main className="p-6 flex-1">
          <div className="max-w-3xl bg-surface border border-slate-200 rounded-lg p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900 mb-1">Catat bug</h1>
            <p className="text-xs text-slate-500 mb-5">
              Cukup judul. Sisanya opsional dan bisa dilengkapi QA saat triase. Tempel screenshot dengan Ctrl+V di mana saja. Token atau password otomatis di-redact.
            </p>

            <QuickBugForm
              action={createBugAction.bind(null, project.id)}
              projectKey={project.key}
              draftKey={`bugdraft:${user.id}:${project.key}`}
              prefsKey={`bugprefs:${user.id}:${project.key}`}
            >
              <DraftAutosave storageKey={`bugdraft:${user.id}:${project.key}`} />
              <div>
                <label htmlFor="bug-title-input" className={LABEL}>Judul bug</label>
                <input
                  id="bug-title-input"
                  type="text"
                  name="title"
                  required
                  autoFocus
                  autoComplete="off"
                  maxLength={200}
                  placeholder="Apa yang salah, di mana. Contoh: Tombol Bayar tidak merespons di Checkout"
                  className={INPUT}
                />
              </div>
              <DuplicateChecker projectKey={project.key} />

              <details className="border border-slate-200 rounded-lg p-3 open:bg-slate-50/60">
                <summary className={SUMMARY}>Tambah detail <span className="font-normal text-xs text-slate-500">(severity, modul, catatan, screenshot, lainnya)</span></summary>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="severity" className={LABEL}>Severity</label>
                      <select id="severity" name="severity" defaultValue={DEFAULT_SEVERITY} data-default={DEFAULT_SEVERITY} className={INPUT}>
                        <option value={BugSeverity.BLOCKER}>Blocker: alur utama lumpuh</option>
                        <option value={BugSeverity.HIGH}>High: fungsi penting gagal</option>
                        <option value={BugSeverity.MEDIUM}>Medium: terganggu, ada jalan lain</option>
                        <option value={BugSeverity.LOW}>Low: minor, teks atau tampilan</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="moduleId" className={LABEL}>Modul</label>
                      {modules.length === 0 ? (
                        <p className="text-slate-500 py-2 text-xs">Belum ada modul (Admin menambahkannya di Pengaturan).</p>
                      ) : (
                        <select id="moduleId" name="moduleId" defaultValue="" data-default="" className={INPUT}>
                          <option value="">Belum dipilih (diisi saat triase)</option>
                          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      )}
                    </div>
                    {canReview && (
                      <div>
                        <label htmlFor="priority" className={LABEL}>Prioritas</label>
                        <select id="priority" name="priority" defaultValue={BugPriority.NORMAL} className={INPUT}>
                          <option value={BugPriority.URGENT}>Urgent</option>
                          <option value={BugPriority.HIGH}>High</option>
                          <option value={BugPriority.NORMAL}>Normal</option>
                          <option value={BugPriority.LOW}>Low</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <details className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-3">
                    <summary className="font-bold cursor-pointer">Panduan severity × prioritas</summary>
                    <dl className="mt-2 space-y-1.5">
                      <div><dt className="inline font-bold">Blocker: </dt><dd className="inline">fitur inti tidak bisa dipakai, tanpa jalan lain. Mis. login gagal untuk semua.</dd></div>
                      <div><dt className="inline font-bold">High: </dt><dd className="inline">fungsi penting salah, ada jalan lain yang merepotkan.</dd></div>
                      <div><dt className="inline font-bold">Medium: </dt><dd className="inline">fungsi sekunder salah atau tampilan mengganggu.</dd></div>
                      <div><dt className="inline font-bold">Low: </dt><dd className="inline">kosmetik atau typo, tidak memengaruhi alur.</dd></div>
                    </dl>
                    <p className="mt-2"><b>Severity</b> = dampak ke pengguna (diisi pelapor). <b>Prioritas</b> = urutan perbaikan (diubah QA saat triase). Logo salah di halaman utama klien bisa Low severity tapi High prioritas.</p>
                  </details>

                  <div>
                    <label htmlFor="description" className={LABEL}>Catatan</label>
                    <textarea
                      id="description"
                      name="description"
                      rows={5}
                      placeholder={"Langkah, hasil aktual, hasil diharapkan.\n1. Login sebagai user X\n2. Klik Bayar\nAktual: tidak ada respons. Harapan: muncul halaman konfirmasi."}
                      className={TEXTAREA}
                    />
                  </div>

                  <ScreenshotInput />

                  <details className="border-t border-slate-200 pt-3">
                    <summary className={SUMMARY}>Lainnya <span className="font-normal text-xs text-slate-500">(tag, environment, versi, tautan, kolom terpisah)</span></summary>
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="tags" className={LABEL}>Tag</label>
                          <input id="tags" type="text" name="tags" placeholder="login, ui, regresi" className={INPUT} />
                          <p className={HINT}>Pisahkan dengan koma, maksimal 10.</p>
                        </div>
                        <div>
                          <label htmlFor="jamUrl" className={LABEL}>Rekaman jam.dev</label>
                          <input id="jamUrl" type="url" name="jamUrl" placeholder="https://jam.dev/c/..." className={INPUT} />
                        </div>
                        <div>
                          <label htmlFor="environment" className={LABEL}>Environment</label>
                          <input id="environment" type="text" name="environment" list="env-options" data-default="" placeholder="Staging, Production, ..." className={INPUT} />
                          <datalist id="env-options"><option value="Production" /><option value="Staging" /><option value="UAT" /><option value="Development" /></datalist>
                        </div>
                        <div>
                          <label htmlFor="appVersion" className={LABEL}>Versi / build</label>
                          <input id="appVersion" type="text" name="appVersion" data-default="" placeholder="v1.4.2 atau 2026.10.23" className={INPUT} />
                          <p className={HINT}>Wajib sebelum bug Draft dibuka (Open).</p>
                        </div>
                        <div>
                          <label htmlFor="taskUrl" className={LABEL}>Link task</label>
                          <input id="taskUrl" type="url" name="taskUrl" placeholder="https://... (Jira, ClickUp, Trello)" className={INPUT} />
                        </div>
                        <div>
                          <label htmlFor="relatedKeys" className={LABEL}>Terkait bug lain</label>
                          <input id="relatedKeys" type="text" name="relatedKeys" placeholder={`${project.key}-12, ${project.key}-15`} className={`${INPUT} font-mono`} />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="links" className={LABEL}>Tautan lain</label>
                        <textarea id="links" name="links" rows={2} placeholder={"https://figma.com/...\nhttps://docs.google.com/..."} className={`${TEXTAREA} font-mono text-xs`} />
                        <p className={HINT}>Satu URL per baris, maksimal 10.</p>
                      </div>
                      <details className="border-t border-slate-200 pt-3">
                        <summary className={SUMMARY}>Pakai kolom terpisah (langkah, harapan, aktual)</summary>
                        <div className="mt-3 space-y-3">
                          <div>
                            <label htmlFor="stepsToReproduce" className={LABEL}>Langkah reproduksi</label>
                            <textarea id="stepsToReproduce" name="stepsToReproduce" rows={4} className={`${TEXTAREA} font-mono text-xs`} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="expectedResult" className={LABEL}>Hasil yang diharapkan</label>
                              <textarea id="expectedResult" name="expectedResult" rows={3} className={TEXTAREA} />
                            </div>
                            <div>
                              <label htmlFor="actualResult" className={LABEL}>Hasil aktual</label>
                              <textarea id="actualResult" name="actualResult" rows={3} className={TEXTAREA} />
                            </div>
                          </div>
                        </div>
                      </details>
                      {canReview && (
                        <label className="flex items-center gap-2 text-slate-700 cursor-pointer pt-1">
                          <input type="checkbox" name="openNow" value="true" className="rounded" />
                          Langsung Open tanpa review (wajib memilih modul)
                        </label>
                      )}
                    </div>
                  </details>
                </div>
              </details>
            </QuickBugForm>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
