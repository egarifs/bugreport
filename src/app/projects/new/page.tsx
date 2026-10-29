import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { recordAuditLog } from "@/lib/user-service";
import { AppShell } from "@/components/layout/app-shell";

export default async function NewProjectPage() {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;

  if (!user?.isAdmin) {
    redirect("/projects");
  }

  return (
    <AppShell>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
          <Link href="/projects" className="text-sm text-slate-500 hover:text-slate-900">
            ← Kembali ke Projects
          </Link>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 text-sm">Buat Project Baru</span>
        </header>

        <main className="p-6 flex-1">
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900 mb-1">Project Baru</h1>
          <p className="text-xs text-slate-500 mb-6">
            Project key digunakan sebagai prefix ID bug (misal: CRM-1, CRM-2).
          </p>

          <ActionForm
            action={async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
              "use server";
              const creator = await requireAdmin();
              const key = (formData.get("key") as string).trim().toUpperCase();
              const name = (formData.get("name") as string).trim();
              const description = (formData.get("description") as string)?.trim() || null;

              if (!key || !name) return { error: "Key dan nama project wajib diisi." };
              if (!/^[A-Z0-9]{1,6}$/.test(key)) return { error: "Key maksimal 6 karakter, hanya huruf kapital dan angka." };
              if (await prisma.project.findUnique({ where: { key } })) return { error: `Key ${key} sudah dipakai project lain.` };

              const project = await prisma.project.create({
                data: {
                  key,
                  name,
                  description,
                  members: {
                    create: {
                      userId: creator.id,
                      role: "ADMIN",
                    },
                  },
                },
              });

              await recordAuditLog({
                projectId: project.id,
                actorId: creator.id,
                actorEmail: creator.email,
                action: "project.create",
                entityType: "project",
                entityId: project.id,
                changes: { after: { key, name } },
              });

              redirect(`/projects/${project.key}`);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Key (Maks 6 karakter huruf kapital)
              </label>
              <input
                type="text"
                name="key"
                required
                maxLength={6}
                pattern="^[A-Z0-9]+$"
                placeholder="CRM"
                className="w-full text-sm font-mono uppercase px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Project
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="CRM Rumah Sakit"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi Singkat (Opsional)
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Sistem informasi CRM untuk RS dan marketing"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Link
                href="/projects"
                className="px-4 py-2 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </Link>
              <SubmitButton pendingText="Menyimpan...">Simpan project</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </main>
    </div>
  </AppShell>
  );
}
