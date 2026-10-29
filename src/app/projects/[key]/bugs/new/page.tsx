import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { activeModules, ownModuleId } from "@/lib/modules";
import { hasPermission } from "@/lib/permissions";
import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import { recordAuditLog } from "@/lib/user-service";
import { BugSeverity, BugPriority, BugStatus } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DuplicateChecker } from "./duplicate-checker";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenshotInput } from "./screenshot-input";
import { parseBugKeys, parseLinks, parseUrl, readScreenshots, type Screenshot } from "@/lib/bug-input";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const LABEL = "block font-bold text-slate-700 mb-1";
const INPUT = "w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-action";
const TEXTAREA = `${INPUT} resize-y min-h-20`;
const HINT = "mt-1 text-xs text-slate-500";

export default async function NewBugPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; isAdmin?: boolean }
    | undefined;

  if (!user?.email || !user.id) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) {
    redirect("/projects");
  }

  const role = project.members[0]?.role;
  const modules = await activeModules(project.id);
  // If QA or Admin reports, can start directly as OPEN if preferred, otherwise DRAFT
  const canDirectOpen = user.isAdmin || role === "QA" || role === "ADMIN";

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
          <Link
            href={`/projects/${project.key}`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Kembali ke {project.key}
          </Link>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 text-sm">
            Laporkan Bug Baru
          </span>
        </header>

        <main className="p-6 flex-1">
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900 mb-1">
            Form Laporan Bug
          </h1>
          <p className="text-xs text-slate-500 mb-6">
            Project <strong>{project.name}</strong> ({project.key}). Kolom bertanda * wajib.
            Pola secret seperti token atau password otomatis di-redact.
          </p>

          <ActionForm action={createBug.bind(null, project.id)} className="space-y-6 text-sm">
            <fieldset className="space-y-3">
              <legend className="text-xs font-bold text-slate-500 mb-2">Ringkasan (wajib)</legend>
              <div>
                <label htmlFor="bug-title-input" className={LABEL}>Judul bug *</label>
                <input
                  id="bug-title-input"
                  type="text"
                  name="title"
                  required
                  maxLength={200}
                  placeholder="[Modul] Apa yang salah, di mana. Contoh: Complaint bisa dibuka user tanpa hak akses via URL"
                  className={INPUT}
                />
              </div>

              <DuplicateChecker projectKey={project.key} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="moduleId" className={LABEL}>Modul{modules.length > 0 && " *"}</label>
                  {modules.length === 0 ? (
                    <p className="text-slate-500 py-2">Belum ada modul. Admin project menambahkannya di Settings.</p>
                  ) : (
                    <select id="moduleId" name="moduleId" required defaultValue="" className={INPUT}>
                      <option value="" disabled>Pilih modul</option>
                      {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label htmlFor="severity" className={LABEL}>Severity *</label>
                  <select id="severity" name="severity" required defaultValue="" className={INPUT}>
                    <option value="" disabled>Pilih dampak</option>
                    <option value={BugSeverity.BLOCKER}>Blocker: sistem/alur utama lumpuh</option>
                    <option value={BugSeverity.HIGH}>High: fungsi penting gagal</option>
                    <option value={BugSeverity.MEDIUM}>Medium: terganggu, ada workaround</option>
                    <option value={BugSeverity.LOW}>Low: minor, teks/tampilan</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="priority" className={LABEL}>Priority</label>
                  <select id="priority" name="priority" defaultValue={BugPriority.NORMAL} className={INPUT}>
                    <option value={BugPriority.URGENT}>Urgent</option>
                    <option value={BugPriority.HIGH}>High</option>
                    <option value={BugPriority.NORMAL}>Normal</option>
                    <option value={BugPriority.LOW}>Low</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3 pt-5 border-t border-slate-200">
              <legend className="text-xs font-bold text-slate-500 mb-2">Detail (opsional, tapi mempercepat perbaikan)</legend>
              <p className="text-xs text-slate-500 -mt-1">Tarik sudut kanan bawah kotak teks untuk memperbesar.</p>
              <div>
                <label htmlFor="description" className={LABEL}>Deskripsi</label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Konteks: siapa terdampak, seberapa sering terjadi, endpoint atau data terkait."
                  className={TEXTAREA}
                />
              </div>
              <div>
                <label htmlFor="stepsToReproduce" className={LABEL}>Langkah reproduksi</label>
                <textarea
                  id="stepsToReproduce"
                  name="stepsToReproduce"
                  rows={5}
                  placeholder={"1. Login sebagai user X\n2. Buka URL /dashboard/complaint\n3. Klik tombol Y"}
                  className={`${TEXTAREA} font-mono text-xs`}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="expectedResult" className={LABEL}>Hasil yang diharapkan</label>
                  <textarea id="expectedResult" name="expectedResult" rows={3} placeholder="Diarahkan ke 403 karena user tidak punya hak akses" className={TEXTAREA} />
                </div>
                <div>
                  <label htmlFor="actualResult" className={LABEL}>Hasil aktual</label>
                  <textarea id="actualResult" name="actualResult" rows={3} placeholder="Halaman terbuka dan menampilkan daftar complaint" className={TEXTAREA} />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3 pt-5 border-t border-slate-200">
              <legend className="text-xs font-bold text-slate-500 mb-2">Bukti</legend>
              <ScreenshotInput />
              <div>
                <label htmlFor="jamUrl" className={LABEL}>Rekaman jam.dev</label>
                <input id="jamUrl" type="url" name="jamUrl" placeholder="https://jam.dev/c/..." className={INPUT} />
                <p className={HINT}>Rekaman layar + console + network dari ekstensi Jam.</p>
              </div>
            </fieldset>

            <fieldset className="space-y-3 pt-5 border-t border-slate-200">
              <legend className="text-xs font-bold text-slate-500 mb-2">Konteks & tautan</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="environment" className={LABEL}>Environment</label>
                  <input id="environment" type="text" name="environment" list="env-options" placeholder="Staging, Production, ..." className={INPUT} />
                  <datalist id="env-options">
                    <option value="Production" />
                    <option value="Staging" />
                    <option value="UAT" />
                    <option value="Development" />
                  </datalist>
                </div>
                <div>
                  <label htmlFor="appVersion" className={LABEL}>Versi / build</label>
                  <input id="appVersion" type="text" name="appVersion" placeholder="v1.4.2 atau 2026.10.23" className={INPUT} />
                  <p className={HINT}>Wajib sebelum bug Draft dibuka (Open).</p>
                </div>
                <div>
                  <label htmlFor="taskUrl" className={LABEL}>Link task</label>
                  <input id="taskUrl" type="url" name="taskUrl" placeholder="https://... (Jira, ClickUp, Trello, dll.)" className={INPUT} />
                </div>
                <div>
                  <label htmlFor="relatedKeys" className={LABEL}>Terkait bug lain</label>
                  <input id="relatedKeys" type="text" name="relatedKeys" placeholder={`${project.key}-12, ${project.key}-15`} className={`${INPUT} font-mono`} />
                  <p className={HINT}>ID bug di project ini, pisahkan dengan koma.</p>
                </div>
              </div>
              <div>
                <label htmlFor="links" className={LABEL}>Tautan lain</label>
                <textarea id="links" name="links" rows={2} placeholder={"https://figma.com/...\nhttps://docs.google.com/..."} className={`${TEXTAREA} font-mono text-xs`} />
                <p className={HINT}>Satu URL per baris, maksimal 10.</p>
              </div>
            </fieldset>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input type="checkbox" name="asDraft" value="true" defaultChecked={!canDirectOpen} className="rounded" />
                Simpan sebagai Draft (menunggu review QA)
              </label>
              <div className="flex gap-2">
                <Link href={`/projects/${project.key}`} className="px-4 py-2 border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Batal
                </Link>
                <SubmitButton pendingText="Mengirim...">Kirim laporan</SubmitButton>
              </div>
            </div>
          </ActionForm>
        </div>
      </main>
    </div>
  </AppShell>
  );
}

const text = (fd: FormData, k: string) => redactSecrets(((fd.get(k) as string) ?? "").trim());

// Module-level (not inline) so Next 15.2.1 keeps bound args; projectId is client-visible and re-checked by authz.
async function createBug(projectId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  "use server";
  const author = await requireProjectPermission(projectId, "bug.create");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { key: true } });

  const title = text(formData, "title");
  const severity = formData.get("severity") as BugSeverity;
  const priority = Object.values(BugPriority).includes(formData.get("priority") as BugPriority)
    ? (formData.get("priority") as BugPriority)
    : BugPriority.NORMAL;
  if (!title) return { error: "Isi judul bug." };
  if (title.length > 200) return { error: "Judul maksimal 200 karakter." };
  if (!Object.values(BugSeverity).includes(severity)) return { error: "Pilih severity." };
  const moduleId = await ownModuleId(projectId, formData.get("moduleId") as string);
  if (!moduleId && (await activeModules(projectId)).length > 0) return { error: "Pilih modul tempat bug terjadi." };

  let jamUrl: string | null, taskUrl: string | null, links: string[], relatedKeys: string[], shots: Screenshot[];
  try {
    jamUrl = parseUrl(formData.get("jamUrl"), "Link jam.dev");
    taskUrl = parseUrl(formData.get("taskUrl"), "Link task");
    links = parseLinks(formData.get("links"));
    relatedKeys = parseBugKeys(formData.get("relatedKeys"));
    shots = await readScreenshots(formData.getAll("screenshots"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const related = relatedKeys.length
    ? await prisma.bug.findMany({ where: { projectId, key: { in: relatedKeys } }, select: { id: true, key: true } })
    : [];
  const missing = relatedKeys.filter((k) => !related.some((r) => r.key === k));
  if (missing.length) return { error: `Bug ${missing.join(", ")} tidak ada di project ini.` };

  const dir = path.join(process.cwd(), "uploads", project.key, "attachments");
  const stored = shots.map((s) => ({ ...s, storedName: `${randomUUID()}.${s.ext}` }));
  if (stored.length) await fs.mkdir(dir, { recursive: true });
  await Promise.all(stored.map((s) => fs.writeFile(path.join(dir, s.storedName), s.bytes)));

  const asDraft = formData.get("asDraft") === "true";
  const status = asDraft || !hasPermission(author.role, "bug.review", author.isAdmin) ? BugStatus.DRAFT : BugStatus.OPEN;
  let bug;
  try {
    bug = await prisma.$transaction(async (tx) => {
      const { bugSeq: number } = await tx.project.update({ where: { id: projectId }, data: { bugSeq: { increment: 1 } }, select: { bugSeq: true } });
      return tx.bug.create({
        data: {
          projectId,
          key: `${project.key}-${number}`,
          number,
          title,
          moduleId,
          severity,
          priority,
          status,
          environment: text(formData, "environment"),
          appVersion: text(formData, "appVersion") || null,
          description: text(formData, "description"),
          stepsToReproduce: text(formData, "stepsToReproduce"),
          expectedResult: text(formData, "expectedResult"),
          actualResult: text(formData, "actualResult"),
          jamUrl,
          taskUrl,
          links,
          related: { connect: related.map((r) => ({ id: r.id })) },
          reporterId: author.id,
          attachments: {
            create: stored.map((s) => ({ fileName: s.name, storedName: s.storedName, fileSize: s.bytes.length, mimeType: s.mime })),
          },
        },
      });
    });
  } catch (e) {
    // No orphan files when the DB write fails.
    await Promise.all(stored.map((s) => fs.rm(path.join(dir, s.storedName), { force: true })));
    throw e;
  }

  await recordAuditLog({
    projectId,
    actorId: author.id,
    actorEmail: author.email,
    action: "bug.create",
    entityType: "bug",
    entityId: bug.id,
    changes: { after: { key: bug.key, status, severity, title, screenshots: stored.length, related: relatedKeys } },
  });

  redirect(`/projects/${project.key}/bugs/${bug.number}`);
}
