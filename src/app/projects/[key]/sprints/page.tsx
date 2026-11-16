import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { AppShell } from "@/components/layout/app-shell";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { SeverityBadge, StatusBadge } from "@/components/ui/bug-badges";
import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { BugStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const DONE: BugStatus[] = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];
const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

async function managedProject(formData: FormData) {
  const project = await prisma.project.findUnique({ where: { key: String(formData.get("projectKey")) }, select: { id: true, key: true } });
  if (!project) throw new Error("Project tidak ditemukan");
  await requireProjectPermission(project.id, "bug.review");
  return project;
}

async function createSprint(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  "use server";
  const project = await managedProject(formData);
  const name = String(formData.get("name") ?? "").trim();
  const startsAt = new Date(String(formData.get("startsAt")));
  const endsAt = new Date(String(formData.get("endsAt")));
  if (!name) return { error: "Nama sprint wajib diisi." };
  if (isNaN(+startsAt) || isNaN(+endsAt)) return { error: "Tanggal mulai dan selesai wajib diisi." };
  if (endsAt < startsAt) return { error: "Tanggal selesai harus setelah tanggal mulai." };
  if (await prisma.sprint.findUnique({ where: { projectId_name: { projectId: project.id, name } } })) return { error: `Sprint "${name}" sudah ada.` };
  const s = await prisma.sprint.create({ data: { projectId: project.id, name, startsAt, endsAt } });
  revalidatePath(`/projects/${project.key}/sprints`);
  redirect(`/projects/${project.key}/sprints?id=${s.id}`);
}

async function addBug(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  "use server";
  const project = await managedProject(formData);
  const sprint = await prisma.sprint.findFirst({ where: { id: String(formData.get("sprintId")), projectId: project.id } });
  if (!sprint) return { error: "Sprint tidak ditemukan." };
  const key = String(formData.get("bugKey") ?? "").trim().toUpperCase();
  const bug = await prisma.bug.findFirst({ where: { key, projectId: project.id }, select: { id: true } });
  if (!bug) return { error: `Bug ${key || "(kosong)"} tidak ada di project ini.` };
  await prisma.bug.update({ where: { id: bug.id }, data: { sprintId: sprint.id } });
  revalidatePath(`/projects/${project.key}/sprints`);
  return { ok: `${key} ditambahkan ke ${sprint.name}.` };
}

async function closeSprint(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  "use server";
  const project = await managedProject(formData);
  const sprint = await prisma.sprint.findFirst({ where: { id: String(formData.get("sprintId")), projectId: project.id } });
  if (!sprint || sprint.status !== "ACTIVE") return { error: "Sprint tidak aktif." };
  const moveTo = String(formData.get("moveTo") ?? "");
  let moved = 0;
  if (moveTo) {
    const target = await prisma.sprint.findFirst({ where: { id: moveTo, projectId: project.id, status: "ACTIVE", NOT: { id: sprint.id } } });
    if (!target) return { error: "Sprint tujuan tidak valid." };
    moved = (await prisma.bug.updateMany({ where: { sprintId: sprint.id, status: { notIn: DONE } }, data: { sprintId: target.id } })).count;
  }
  await prisma.sprint.update({ where: { id: sprint.id }, data: { status: "COMPLETED", closedAt: new Date() } });
  revalidatePath(`/projects/${project.key}/sprints`);
  return { ok: `Sprint ditutup${moved ? `, ${moved} bug dipindah` : ""}.` };
}

export default async function SprintsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ id?: string; f?: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;
  if (!user?.id) redirect("/login");
  const { key } = await params;
  const { id, f } = await searchParams;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } }, sprints: { orderBy: { startsAt: "desc" } } },
  });
  if (!project) notFound();
  const role = project.members[0]?.role ?? null;
  if (!hasPermission(role, "project.read", user.isAdmin)) return <ForbiddenState projectKey={project.key} />;
  const canManage = hasPermission(role, "bug.review", user.isAdmin);

  const sprint = project.sprints.find((s) => s.id === id) ?? project.sprints.find((s) => s.status === "ACTIVE") ?? project.sprints[0];
  const bugs = sprint
    ? await prisma.bug.findMany({
        where: { sprintId: sprint.id },
        orderBy: { number: "asc" },
        include: { assignee: { select: { name: true, email: true } } },
      })
    : [];
  const now = new Date();
  const isDone = (b: (typeof bugs)[number]) => DONE.includes(b.status);
  const overdue = (b: (typeof bugs)[number]) => !!b.dueAt && b.dueAt < now && !isDone(b) && b.status !== "DRAFT";
  const done = bugs.filter(isDone).length;
  const ready = bugs.filter((b) => b.status === "READY_FOR_VERIFICATION").length;
  const late = bugs.filter(overdue).length;
  const shown = bugs.filter((b) => (f === "open" ? !isDone(b) : f === "late" ? overdue(b) : true));
  const others = project.sprints.filter((s) => s.id !== sprint?.id && s.status === "ACTIVE");
  const base = `/projects/${project.key}/sprints?id=${sprint?.id ?? ""}`;
  const inp = "text-sm px-3 py-2 border border-slate-300 rounded bg-surface min-h-[44px]";

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Sprint</div>
            <h1 className="text-xl font-bold text-slate-900">{sprint?.name ?? "Belum ada sprint"}</h1>
            {sprint && (
              <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
                {fmt(sprint.startsAt)} – {fmt(sprint.endsAt)}
                <span className={`px-1.5 rounded text-xs font-bold ${sprint.status === "ACTIVE" ? "bg-ok-bg text-ok" : "bg-slate-100 text-slate-700"}`}>
                  {sprint.status === "ACTIVE" ? "Aktif" : "Selesai"}
                </span>
              </p>
            )}
          </div>
          {project.sprints.length > 1 && (
            <nav aria-label="Pilih sprint" className="flex flex-wrap gap-2">
              {project.sprints.map((s) => (
                <Link key={s.id} href={`/projects/${project.key}/sprints?id=${s.id}`} aria-current={s.id === sprint?.id ? "page" : undefined}
                  className={`px-3 min-h-[44px] flex items-center text-xs font-bold rounded border ${s.id === sprint?.id ? "bg-ink text-on-ink border-ink" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                  {s.name}
                </Link>
              ))}
            </nav>
          )}
        </header>

        <main className="p-6 space-y-6 flex-1">
          {sprint && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  [`${done} / ${bugs.length}`, "Bug selesai"],
                  [String(late), "Lewat tenggat"],
                  [String(ready), "Perlu verifikasi"],
                  [String(bugs.length - done), "Belum selesai"],
                ].map(([v, l]) => (
                  <div key={l} className="bg-surface border border-slate-200 rounded p-4">
                    <div className="text-2xl font-bold text-slate-900">{v}</div>
                    <div className="text-xs text-slate-500">{l}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Saring bug" className="flex gap-2">
                  {[["", `Semua ${bugs.length}`], ["open", `Belum selesai ${bugs.length - done}`], ["late", `Lewat tenggat ${late}`]].map(([v, l]) => (
                    <Link key={v} href={v ? `${base}&f=${v}` : base} aria-current={(f ?? "") === v ? "true" : undefined}
                      className={`px-3 min-h-[44px] flex items-center text-xs font-bold rounded border ${(f ?? "") === v ? "bg-action-soft text-link border-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                      {l}
                    </Link>
                  ))}
                </div>
                {canManage && sprint.status === "ACTIVE" && (
                  <div className="ml-auto">
                    <ActionForm action={addBug} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="projectKey" value={project.key} />
                      <input type="hidden" name="sprintId" value={sprint.id} />
                      <input name="bugKey" aria-label="Kode bug" placeholder={`${project.key}-1`} className={`${inp} w-32 font-mono uppercase`} />
                      <SubmitButton pendingText="Menambah...">+ Tambah bug</SubmitButton>
                    </ActionForm>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto bg-surface border border-slate-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs text-slate-600">
                    <tr><th className="p-3">ID</th><th className="p-3">Judul</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Penanggung jawab</th><th className="p-3">Tenggat</th><th className="p-3">Diperbaiki di</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-xs text-slate-500">Tidak ada bug di tampilan ini.</td></tr>}
                    {shown.map((b) => (
                      <tr key={b.id}>
                        <td className="p-3 font-mono"><Link href={`/projects/${project.key}/bugs/${b.number}`} className="text-link hover:underline">{b.key}</Link></td>
                        <td className="p-3 text-slate-900">{b.title}</td>
                        <td className="p-3"><SeverityBadge severity={b.severity} /></td>
                        <td className="p-3"><StatusBadge status={b.status} /></td>
                        <td className="p-3 text-slate-600">{b.assignee ? b.assignee.name || b.assignee.email : "—"}</td>
                        <td className={`p-3 ${overdue(b) ? "text-bad font-bold" : "text-slate-600"}`}>{b.dueAt ? `${fmt(b.dueAt)}${overdue(b) ? " · lewat" : ""}` : "—"}</td>
                        <td className="p-3 font-mono text-xs">{b.fixedInVersion ? `${b.fixedInVersion}${b.fixedInBuild ? ` · ${b.fixedInBuild}` : ""}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canManage && sprint.status === "ACTIVE" && (
                <ActionForm action={closeSprint} className="bg-slate-100 border border-slate-200 rounded p-4 flex flex-wrap items-center gap-3">
                  <input type="hidden" name="projectKey" value={project.key} />
                  <input type="hidden" name="sprintId" value={sprint.id} />
                  <span className="text-sm font-bold text-slate-900">Tutup sprint</span>
                  <label className="text-xs text-slate-600 flex items-center gap-2">
                    Bug belum selesai
                    <select name="moveTo" className={inp} defaultValue="">
                      <option value="">Biarkan di sprint ini</option>
                      {others.map((s) => <option key={s.id} value={s.id}>Pindah ke {s.name}</option>)}
                    </select>
                  </label>
                  <SubmitButton pendingText="Menutup..." className="px-3.5 py-2 bg-ink hover:bg-ink-hover text-on-ink text-sm font-bold rounded min-h-[44px]">Tutup sprint</SubmitButton>
                </ActionForm>
              )}
            </>
          )}

          {canManage && (
            <section className="bg-surface border border-slate-200 rounded p-4">
              <h2 className="text-base font-bold text-slate-900 mb-3">Sprint baru</h2>
              <ActionForm action={createSprint} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="projectKey" value={project.key} />
                <label className="text-xs font-bold text-slate-700 flex flex-col gap-1">Nama<input name="name" required placeholder="Sprint 15" className={inp} /></label>
                <label className="text-xs font-bold text-slate-700 flex flex-col gap-1">Mulai<input type="date" name="startsAt" required className={inp} /></label>
                <label className="text-xs font-bold text-slate-700 flex flex-col gap-1">Selesai<input type="date" name="endsAt" required className={inp} /></label>
                <SubmitButton pendingText="Membuat...">Buat sprint</SubmitButton>
              </ActionForm>
            </section>
          )}
        </main>
      </div>
    </AppShell>
  );
}
