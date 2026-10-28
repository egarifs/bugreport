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
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 text-sm">
            Laporkan Bug Baru
          </span>
        </header>

        <main className="max-w-3xl w-full mx-auto p-6 flex-1">
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900 mb-1">
            Form Laporan Bug
          </h1>
          <p className="text-xs text-slate-500 mb-6">
            Laporan dibuat di project <strong>{project.name}</strong> ({project.key}).
            Pola secret seperti token atau password akan otomatis di-redact.
          </p>

          <form
            action={async (formData) => {
              "use server";
              const author = await requireProjectPermission(project.id, "bug.create");
              const title = redactSecrets((formData.get("title") as string).trim());
              const component = (formData.get("component") as string)?.trim() || null;
              const severity = formData.get("severity") as BugSeverity;
              const priority = (formData.get("priority") as BugPriority) || BugPriority.NORMAL;
              const environment = (formData.get("environment") as string).trim();
              const appVersion = (formData.get("appVersion") as string)?.trim() || null;
              const stepsToReproduce = redactSecrets(
                (formData.get("stepsToReproduce") as string).trim()
              );
              const expectedResult = redactSecrets(
                (formData.get("expectedResult") as string).trim()
              );
              const actualResult = redactSecrets(
                (formData.get("actualResult") as string).trim()
              );
              const description = redactSecrets(
                (formData.get("description") as string)?.trim() || title
              );
              const asDraft = formData.get("asDraft") === "true";

              if (!title || !stepsToReproduce || !expectedResult || !actualResult || !environment) {
                return;
              }

              // Atomically increment bugSeq for this project
              const updatedProject = await prisma.project.update({
                where: { id: project.id },
                data: { bugSeq: { increment: 1 } },
                select: { bugSeq: true },
              });

              const number = updatedProject.bugSeq;
              const bugKey = `${project.key}-${number}`;
              const initialStatus =
                asDraft || !hasPermission(author.role, "bug.review", author.isAdmin) ? BugStatus.DRAFT : BugStatus.OPEN;

              const bug = await prisma.bug.create({
                data: {
                  projectId: project.id,
                  key: bugKey,
                  number,
                  title,
                  component,
                  severity,
                  priority,
                  status: initialStatus,
                  environment,
                  appVersion,
                  description,
                  stepsToReproduce,
                  expectedResult,
                  actualResult,
                  reporterId: author.id,
                },
              });

              await recordAuditLog({
                projectId: project.id,
                actorId: author.id,
                actorEmail: author.email,
                action: "bug.create",
                entityType: "bug",
                entityId: bug.id,
                changes: {
                  after: {
                    key: bugKey,
                    status: initialStatus,
                    severity,
                    title,
                  },
                },
              });

              redirect(`/projects/${project.key}/bugs/${number}`);
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Judul Bug *
              </label>
              <input
                id="bug-title-input"
                type="text"
                name="title"
                required
                placeholder="Contoh: Halaman Complaint bisa dibuka user tanpa hak akses via URL langsung"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <DuplicateChecker projectKey={project.key} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Area / Modul
                </label>
                <input
                  type="text"
                  name="component"
                  placeholder="Access Control, Dashboard, dll."
                  className="w-full px-3 py-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Severity *
                </label>
                <select
                  name="severity"
                  required
                  defaultValue={BugSeverity.HIGH}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                >
                  <option value={BugSeverity.BLOCKER}>BLOCKER (Sistem lumpuh)</option>
                  <option value={BugSeverity.HIGH}>HIGH (Fungsi penting gagal)</option>
                  <option value={BugSeverity.MEDIUM}>MEDIUM (Terganggu, ada workaround)</option>
                  <option value={BugSeverity.LOW}>LOW (Minor, teks/tampilan)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  defaultValue={BugPriority.NORMAL}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                >
                  <option value={BugPriority.URGENT}>URGENT</option>
                  <option value={BugPriority.HIGH}>HIGH</option>
                  <option value={BugPriority.NORMAL}>NORMAL</option>
                  <option value={BugPriority.LOW}>LOW</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Environment *
                </label>
                <input
                  type="text"
                  name="environment"
                  required
                  defaultValue="Staging"
                  placeholder="Staging, Production, dll."
                  className="w-full px-3 py-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Versi / Build Aplikasi (Opsional)
                </label>
                <input
                  type="text"
                  name="appVersion"
                  placeholder="v1.4.2 atau 2026.10.23"
                  className="w-full px-3 py-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Langkah Reproduksi (Steps to Reproduce) *
              </label>
              <textarea
                name="stepsToReproduce"
                required
                rows={4}
                placeholder="1. Login sebagai user X&#10;2. Buka URL /dashboard/complaint&#10;3. Klik tombol Y"
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hasil yang Diharapkan (Expected Result) *
                </label>
                <textarea
                  name="expectedResult"
                  required
                  rows={3}
                  placeholder="Diarahkan ke 403 atau dashboard karena user tidak punya hak akses"
                  className="w-full px-3 py-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hasil Aktual (Actual Result) *
                </label>
                <textarea
                  name="actualResult"
                  required
                  rows={3}
                  placeholder="Halaman terbuka dan menampilkan data daftar complaint"
                  className="w-full px-3 py-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Catatan / Deskripsi Tambahan (Opsional)
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="Catatan modul, endpoint, konteks tambahan..."
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  name="asDraft"
                  value="true"
                  defaultChecked={!canDirectOpen}
                  className="rounded"
                />
                Simpan sebagai Draft (menunggu review QA)
              </label>

              <div className="flex gap-2">
                <Link
                  href={`/projects/${project.key}`}
                  className="px-4 py-2 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium"
                >
                  Kirim Laporan Bug
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  </AppShell>
  );
}
