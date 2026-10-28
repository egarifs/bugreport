import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
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

  const role: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canManage = hasPermission(role, "doc.manage", user.isAdmin);

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {project.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              Business Documents (PRD / BRD)
            </span>
          </div>
        </header>

        <main className="max-w-5xl w-full mx-auto p-6 space-y-8 flex-1">
          {/* Upload Document Section */}
          {canManage && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-1">
                Upload Dokumen Baru / Revisi Versi
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Mendukung PDF & Markdown (.md) hingga 20 MB. Upload dengan judul yang sama otomatis menghasilkan versi baru (v1, v2, dst).
              </p>

              <form
                action={async (formData: FormData) => {
                  "use server";
                  const actor = await requireProjectPermission(project.id, "doc.manage");
                  const title = (formData.get("title") as string)?.trim();
                  const description = (formData.get("description") as string)?.trim() || null;
                  const file = formData.get("file") as File;

                  if (!title || !file || file.size === 0) return;
                  if (file.size > 20 * 1024 * 1024) {
                    throw new Error("File melebihi batas 20 MB.");
                  }
                  const ext = path.extname(file.name).toLowerCase();
                  if (ext !== ".pdf" && ext !== ".md") throw new Error("Hanya PDF atau Markdown (.md).");
                  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
                  if (ext === ".pdf" && head !== "%PDF-") throw new Error("File bukan PDF valid.");

                  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

                  // Ensure upload directory exists
                  const uploadDir = path.join(process.cwd(), "uploads", project.key, "docs");
                  await fs.mkdir(uploadDir, { recursive: true });

                  const storedFileName = `${slug}_${Date.now()}${ext}`;
                  const storedFilePath = path.join(uploadDir, storedFileName);

                  const bytes = await file.arrayBuffer();
                  await fs.writeFile(storedFilePath, Buffer.from(bytes));

                  // Upsert document record
                  let doc = await prisma.businessDoc.findUnique({
                    where: { projectId_slug: { projectId: project.id, slug } },
                    include: { versions: { orderBy: { versionNum: "desc" }, take: 1 } },
                  });

                  let nextVersion = 1;
                  if (doc) {
                    nextVersion = (doc.versions[0]?.versionNum || 0) + 1;
                    // Mark old versions as not current
                    await prisma.businessDocVersion.updateMany({
                      where: { docId: doc.id },
                      data: { isCurrent: false },
                    });
                  } else {
                    doc = await prisma.businessDoc.create({
                      data: {
                        projectId: project.id,
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
                      isCurrent: true,
                      uploadedById: actor.id,
                    },
                  });

                  revalidatePath(`/projects/${project.key}/docs`);
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
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
                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition"
                  >
                    Simpan & Upload Versi Baru
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Document list */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Dokumen Bisnis
            </h2>

            {project.businessDocs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500">
                Belum ada dokumen bisnis di-upload untuk project ini.
              </div>
            ) : (
              <div className="space-y-3">
                {project.businessDocs.map((doc) => {
                  const currentVer = doc.versions.find((v) => v.isCurrent) || doc.versions[0];
                  return (
                    <div
                      key={doc.id}
                      className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 text-sm">
                              {doc.title}
                            </h3>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              v{currentVer?.versionNum ?? 1} (Aktif)
                            </span>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-slate-600 mt-1">
                              {doc.description}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-2">
                            File: {currentVer?.fileName} • {((currentVer?.fileSize || 0) / 1024).toFixed(1)} KB • Diperbarui {doc.updatedAt.toLocaleDateString()}
                          </p>
                        </div>

                        {/* Version history list */}
                        <div className="text-right">
                          <span className="text-[11px] font-medium text-slate-500">
                            Riwayat Versi ({doc.versions.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1 justify-end">
                            {doc.versions.map((ver) => (
                              <span
                                key={ver.id}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                  ver.isCurrent
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                v{ver.versionNum}
                              </span>
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
