import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notifyDocApproval } from "@/lib/notify";
import fs from "node:fs/promises";
import Link from "next/link";
import path from "node:path";

export default async function BusinessDocsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
      businessDocs: {
        orderBy: { updatedAt: "desc" },
        include: {
          versions: {
            orderBy: { versionNum: "desc" },
          },
        },
      },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");
  // Bind primitives: server action closures must not capture the narrowed prisma object.
  const pkey = project.key;

  const role: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  // Revisi menunggu/ditolak hanya terlihat oleh pengelola dokumen; lainnya hanya yang disetujui.
  if (!hasPermission(role, "doc.manage", user.isAdmin)) {
    for (const d of project.businessDocs) d.versions = d.versions.filter((v) => v.status === "APPROVED");
    project.businessDocs = project.businessDocs.filter((d) => d.versions.length > 0);
  }
  const canManage = hasPermission(role, "doc.manage", user.isAdmin);

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-surface border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {project.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              Business Documents (PRD / BRD)
            </span>
          </div>
          <div className="flex gap-4">
            <Link href={`/projects/${project.key}/stlc`} className="text-xs font-bold underline min-h-[44px] flex items-center">
              Rencana uji & laporan
            </Link>
            <Link href={`/projects/${project.key}/rtm`} className="text-xs font-bold underline min-h-[44px] flex items-center">
              Matriks keterlacakan (RTM)
            </Link>
          </div>
        </header>

        <main className="p-6 space-y-8 flex-1">
          {/* Upload Document Section */}
          {canManage && (
            <div className="bg-surface border border-slate-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-1">
                Upload Dokumen Baru / Revisi Versi
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Mendukung PDF & Markdown (.md) hingga 20 MB. Upload dengan judul yang sama menjadi revisi baru yang menunggu persetujuan Admin; versi lama tetap berlaku.
              </p>

              <ActionForm
                action={async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
                  "use server";
                  // Tanpa closure: build produksi Next 15.2 menghilangkan `pid` dari variabel tertangkap (ReferenceError).
                  const pkey = String(formData.get("projectKey") ?? "");
                  const pid = (await prisma.project.findUnique({ where: { key: pkey }, select: { id: true } }))?.id;
                  if (!pid) return { error: "Project tidak ditemukan." };
                  const actor = await requireProjectPermission(pid, "doc.manage");
                  const title = (formData.get("title") as string)?.trim();
                  const description = (formData.get("description") as string)?.trim() || null;
                  const file = formData.get("file") as File;

                  const changeNote = (formData.get("changeNote") as string)?.trim() || null;
                  if (!title || !file || file.size === 0) return { error: "Judul dan file wajib diisi." };
                  if (file.size > 20 * 1024 * 1024) return { error: "File melebihi batas 20 MB." };
                  const ext = path.extname(file.name).toLowerCase();
                  if (ext !== ".pdf" && ext !== ".md") return { error: "Hanya PDF atau Markdown (.md)." };
                  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
                  if (ext === ".pdf" && head !== "%PDF-") return { error: "File bukan PDF valid." };

                  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                  if (!slug) return { error: "Judul harus memuat huruf atau angka." };

                  // Ensure upload directory exists
                  const uploadDir = path.join(process.cwd(), "uploads", pkey, "docs");
                  await fs.mkdir(uploadDir, { recursive: true });

                  const storedFileName = `${slug}_${Date.now()}${ext}`;
                  const storedFilePath = path.join(uploadDir, storedFileName);

                  const bytes = await file.arrayBuffer();
                  await fs.writeFile(storedFilePath, Buffer.from(bytes));

                  // Upsert document record
                  let doc = await prisma.businessDoc.findUnique({
                    where: { projectId_slug: { projectId: pid, slug } },
                    include: { versions: { orderBy: { versionNum: "desc" }, take: 1 } },
                  });

                  let nextVersion = 1;
                  if (doc) {
                    if (!changeNote) {
                      await fs.unlink(storedFilePath).catch(() => {});
                      return { error: "Catatan perubahan wajib untuk revisi." };
                    }
                    nextVersion = (doc.versions[0]?.versionNum || 0) + 1;
                    // Versi lama tetap berlaku sampai revisi disetujui.
                  } else {
                    doc = await prisma.businessDoc.create({
                      data: {
                        projectId: pid,
                        title,
                        slug,
                        description,
                      },
                      include: { versions: true },
                    });
                  }

                  // Create new version
                  await prisma.businessDocVersion.create({
                    data: {
                      docId: doc.id,
                      versionNum: nextVersion,
                      fileName: file.name,
                      storedPath: storedFilePath,
                      fileSize: file.size,
                      mimeType: file.type || "application/octet-stream",
                      isCurrent: nextVersion === 1,
                      status: nextVersion === 1 ? "APPROVED" : "PENDING",
                      changeNote,
                      uploadedById: actor.id,
                    },
                  });

                  if (nextVersion > 1) {
                    const approvers = await prisma.projectMember.findMany({ where: { projectId: pid }, select: { userId: true } });
                    await notifyDocApproval({ docId: doc.id, docTitle: title, projectId: pid, projectKey: pkey, targetUserIds: approvers.map((m) => m.userId), actor });
                  }
                  revalidatePath(`/projects/${pkey}/docs`);
                  return { ok: nextVersion === 1 ? `${title} tersimpan sebagai v1.` : `${title} v${nextVersion} menunggu persetujuan Admin.` };
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <input type="hidden" name="projectKey" value={pkey} />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Dokumen *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Misal: PRD Paket RS"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi / Ringkasan
                  </label>
                  <input
                    type="text"
                    name="description"
                    placeholder="Spesifikasi modul paket rumah sakit"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    File (PDF / MD) *
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".pdf,.md"
                    required
                    className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan perubahan (wajib untuk revisi dokumen yang sudah ada)
                  </label>
                  <input
                    type="text"
                    name="changeNote"
                    placeholder="Mis. Batas ekspor CSV dipindah ke Admin, diminta PO"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs outline-none"
                  />
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <SubmitButton pendingText="Mengunggah...">Simpan versi baru</SubmitButton>
                </div>
              </ActionForm>
            </div>
          )}

          {/* Document list */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Dokumen Bisnis
            </h2>

            {project.businessDocs.length === 0 ? (
              <div className="bg-surface border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500">
                Belum ada dokumen bisnis di-upload untuk project ini.
              </div>
            ) : (
              <div className="space-y-3">
                {project.businessDocs.map((doc) => {
                  const currentVer = doc.versions.find((v) => v.isCurrent) || doc.versions[0];
                  return (
                    <div
                      key={doc.id}
                      className="bg-surface border border-slate-200 rounded-lg p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 text-sm">
                              <Link href={`/projects/${pkey}/docs/${doc.slug}`} className="hover:underline">
                                {doc.title}
                              </Link>
                            </h3>
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-ok-bg text-ok">
                              v{currentVer?.versionNum ?? 1} (Aktif)
                            </span>
                            {doc.versions.some((v) => v.status === "PENDING") && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-warn-bg text-warn">Revisi menunggu persetujuan</span>
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-xs text-slate-600 mt-1">
                              {doc.description}
                            </p>
                          )}
                          <Link
                            href={`/projects/${pkey}/docs/${doc.slug}`}
                            className="inline-block mt-3 px-3 py-1.5 bg-ink text-on-ink rounded text-xs font-bold hover:bg-slate-700"
                          >
                            Buka dokumen
                          </Link>
                          <p className="text-xs text-slate-500 mt-2">
                            File: {currentVer?.fileName} • {((currentVer?.fileSize || 0) / 1024).toFixed(1)} KB • Diperbarui {doc.updatedAt.toLocaleDateString()}
                          </p>
                        </div>

                        {/* Version history list */}
                        <div className="text-right">
                          <span className="text-xs font-medium text-slate-500">
                            Riwayat Versi ({doc.versions.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1 justify-end">
                            {doc.versions.map((ver) => (
                              <Link
                                href={`/projects/${pkey}/docs/${doc.slug}?v=${ver.versionNum}`}
                                key={ver.id}
                                className={`text-xs font-mono px-2 py-0.5 rounded border ${
                                  ver.isCurrent
                                    ? "bg-ink text-on-ink border-slate-900"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                v{ver.versionNum}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </AppShell>
  );
}
