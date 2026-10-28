import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";

// Master module list per project. Only project.manage (admin) may change it; everyone else sees it read-only.
export async function ModulesSection({ projectId, projectKey, canManage }: { projectId: string; projectKey: string; canManage: boolean }) {
  const modules = await prisma.module.findMany({
    where: { projectId },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { bugs: true, testCases: true } } },
  });
  const path = `/projects/${projectKey}/settings`;

  async function addModule(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    await requireProjectPermission(projectId, "project.manage");
    const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
    if (!name) return { error: "Isi nama modul." };
    if (name.length > 60) return { error: "Nama modul maksimal 60 karakter." };
    const dupe = await prisma.module.findFirst({ where: { projectId, name: { equals: name, mode: "insensitive" } } });
    if (dupe) return { error: `Modul "${dupe.name}" sudah ada${dupe.archivedAt ? " (diarsipkan, aktifkan lagi dari daftar)" : ""}.` };
    const last = await prisma.module.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    await prisma.module.create({ data: { projectId, name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    revalidatePath(path);
    return { ok: `Modul "${name}" ditambahkan.` };
  }

  async function updateModule(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    await requireProjectPermission(projectId, "project.manage");
    const id = String(formData.get("id"));
    const op = String(formData.get("op"));
    const mod = await prisma.module.findFirst({ where: { id, projectId } });
    if (!mod) return { error: "Modul tidak ditemukan." };

    if (op === "rename") {
      const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
      if (!name || name.length > 60) return { error: "Nama modul wajib diisi, maksimal 60 karakter." };
      const dupe = await prisma.module.findFirst({ where: { projectId, id: { not: id }, name: { equals: name, mode: "insensitive" } } });
      if (dupe) return { error: `Nama "${dupe.name}" sudah dipakai modul lain.` };
      await prisma.module.update({ where: { id }, data: { name } });
    } else if (op === "archive" || op === "restore") {
      // Archive instead of delete: existing bugs/test cases keep their module for reports.
      await prisma.module.update({ where: { id }, data: { archivedAt: op === "archive" ? new Date() : null } });
    } else if (op === "up" || op === "down") {
      const neighbor = await prisma.module.findFirst({
        where: { projectId, archivedAt: null, sortOrder: op === "up" ? { lt: mod.sortOrder } : { gt: mod.sortOrder } },
        orderBy: { sortOrder: op === "up" ? "desc" : "asc" },
      });
      if (neighbor) {
        await prisma.$transaction([
          prisma.module.update({ where: { id: mod.id }, data: { sortOrder: neighbor.sortOrder } }),
          prisma.module.update({ where: { id: neighbor.id }, data: { sortOrder: mod.sortOrder } }),
        ]);
      }
    }
    revalidatePath(path);
  }

  const active = modules.filter((m) => !m.archivedAt);
  return (
    <section className="bg-white border border-slate-200 rounded p-6" aria-labelledby="modules-heading">
      <h2 id="modules-heading" className="text-base font-bold text-slate-900">Modul aplikasi</h2>
      <p className="text-sm text-slate-600 mb-4 max-w-prose">
        Daftar area aplikasi yang diuji. Bug wajib punya modul sebelum dibuka dari Draft, dan test case diimpor
        hanya ke modul yang terdaftar di sini.
      </p>

      {modules.length === 0 ? (
        <p className="text-sm text-slate-600 mb-4">Belum ada modul. Tambahkan modul pertama, misalnya Login atau Billing.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded mb-4">
          {modules.map((m) => {
            const i = active.indexOf(m);
            return (
              <li key={m.id} className={`p-3 flex flex-wrap items-center gap-2 text-sm ${m.archivedAt ? "bg-slate-50 text-slate-500" : ""}`}>
                {canManage && !m.archivedAt ? (
                  <ActionForm action={updateModule} className="flex flex-wrap items-center gap-2 flex-1 min-w-[16rem]">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="op" value="rename" />
                    <label className="sr-only" htmlFor={`m-${m.id}`}>Nama modul</label>
                    <input id={`m-${m.id}`} name="name" defaultValue={m.name} maxLength={60} className="px-2 py-1 border border-slate-300 rounded flex-1 min-w-[10rem]" />
                    <SubmitButton pendingText="Menyimpan..." className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-100 font-bold">Simpan nama</SubmitButton>
                  </ActionForm>
                ) : (
                  <span className="flex-1 font-bold">{m.name}{m.archivedAt && " (diarsipkan)"}</span>
                )}
                <span className="text-xs text-slate-500">{m._count.bugs} bug, {m._count.testCases} test case</span>
                {canManage && (
                  <span className="flex gap-1">
                    {!m.archivedAt && (
                      <>
                        <OpButton action={updateModule} id={m.id} op="up" label={`Naikkan ${m.name}`} disabled={i === 0}>Naik</OpButton>
                        <OpButton action={updateModule} id={m.id} op="down" label={`Turunkan ${m.name}`} disabled={i === active.length - 1}>Turun</OpButton>
                      </>
                    )}
                    <OpButton action={updateModule} id={m.id} op={m.archivedAt ? "restore" : "archive"} label={`${m.archivedAt ? "Aktifkan" : "Arsipkan"} ${m.name}`}>
                      {m.archivedAt ? "Aktifkan" : "Arsipkan"}
                    </OpButton>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <ActionForm action={addModule} className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="new-module" className="sr-only">Nama modul baru</label>
          <input id="new-module" name="name" required maxLength={60} placeholder="Nama modul baru" className="px-3 py-1.5 border border-slate-300 rounded w-64" />
          <SubmitButton pendingText="Menambahkan...">Tambah modul</SubmitButton>
        </ActionForm>
      ) : (
        <p className="text-sm text-slate-500">Hanya admin project yang bisa mengubah daftar modul.</p>
      )}
    </section>
  );
}

function OpButton({
  action, id, op, label, disabled, children,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  id: string; op: string; label: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      {disabled ? (
        <button type="button" disabled aria-label={label} className="px-2 py-1 border border-slate-200 rounded text-slate-300">{children}</button>
      ) : (
        <SubmitButton pendingText="..." className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-100">
          <span aria-label={label}>{children}</span>
        </SubmitButton>
      )}
    </ActionForm>
  );
}
