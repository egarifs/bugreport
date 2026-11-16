import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProjectRole } from "@prisma/client";
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
        <header className="px-6 py-4 border-b border-slate-200">
          <div className="text-xs text-slate-500">
            <Link href="/projects" className="hover:underline">Semua project</Link> / Baru
          </div>
          <h1 className="text-xl font-bold text-slate-900">Buat project</h1>
        </header>

        <main className="p-6 flex-1">
        <div className="bg-surface border border-slate-200 rounded-lg p-6 shadow-sm">
          <p className="text-sm text-slate-600 mb-6">
            Kode project jadi awalan ID bug (CRM-1, CRM-2) dan tidak bisa diubah. Anda otomatis menjadi Admin project.
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

              const modules = [...new Set(((formData.get("modules") as string) ?? "").split(",").map((m) => m.trim()).filter(Boolean))];
              const invites: { email: string; role: ProjectRole }[] = [];
              for (const i of [1, 2, 3]) {
                const email = ((formData.get(`email${i}`) as string) ?? "").trim().toLowerCase();
                const role = formData.get(`role${i}`) as string;
                if (!email) continue;
                if (!(Object.values(ProjectRole) as string[]).includes(role)) return { error: `Peran anggota ${i} tidak valid.` };
                invites.push({ email, role: role as ProjectRole });
              }
              const found = await prisma.user.findMany({ where: { email: { in: invites.map((v) => v.email) }, status: "ACTIVE" }, select: { id: true, email: true } });
              const missing = invites.filter((v) => !found.some((u) => u.email === v.email)).map((v) => v.email);
              if (missing.length) return { error: `Belum terdaftar atau belum aktif: ${missing.join(", ")}. Minta mereka masuk dan disetujui dulu.` };
              const members = invites
                .map((v) => ({ userId: found.find((u) => u.email === v.email)!.id, role: v.role }))
                .filter((m) => m.userId !== creator.id);

              const project = await prisma.project.create({
                data: {
                  key,
                  name,
                  description,
                  members: { create: [{ userId: creator.id, role: "ADMIN" }, ...members] },
                  modules: { create: modules.map((m, sortOrder) => ({ name: m, sortOrder })) },
                },
              });

              await recordAuditLog({
                projectId: project.id,
                actorId: creator.id,
                actorEmail: creator.email,
                action: "project.create",
                entityType: "project",
                entityId: project.id,
                changes: { after: { key, name, modules, members: invites } },
              });

              redirect(`/projects/${project.key}`);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="key" className="block text-xs font-semibold text-slate-700 mb-1">
                Kode <span className="font-normal text-slate-500">maks 6 huruf kapital/angka, tidak bisa diubah</span>
              </label>
              <input
                id="key"
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
              <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                Nama project
              </label>
              <input
                id="name"
                type="text"
                name="name"
                required
                placeholder="CRM Rumah Sakit"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi <span className="font-normal text-slate-500">opsional</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Sistem informasi CRM untuk RS dan marketing"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="modules" className="block text-xs font-semibold text-slate-700 mb-1">
                Modul awal <span className="font-normal text-slate-500">opsional, pisahkan dengan koma, bisa diubah di Pengaturan</span>
              </label>
              <input
                id="modules"
                type="text"
                name="modules"
                placeholder="Leads, Kontak, Integrasi WhatsApp, Laporan"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <fieldset>
              <legend className="block text-xs font-semibold text-slate-700 mb-1">
                Tambah anggota <span className="font-normal text-slate-500">opsional, user harus sudah aktif</span>
              </legend>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="email"
                      name={`email${i}`}
                      aria-label={`Email anggota ${i}`}
                      placeholder="nama@sismedika.com"
                      className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <select
                      name={`role${i}`}
                      aria-label={`Peran anggota ${i}`}
                      defaultValue="QA"
                      className="text-sm px-2 py-2 border border-slate-300 rounded"
                    >
                      <option value="QA">QA</option>
                      <option value="DEVELOPER">Developer</option>
                      <option value="VENDOR">Vendor</option>
                      <option value="CLIENT">Client</option>
                      <option value="VIEWER">Viewer</option>
                      <option value="ADMIN">Admin Project</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="pt-2 flex justify-end gap-2">
              <Link
                href="/projects"
                className="px-4 py-2 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </Link>
              <SubmitButton pendingText="Menyimpan...">Buat project</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </main>
    </div>
  </AppShell>
  );
}
