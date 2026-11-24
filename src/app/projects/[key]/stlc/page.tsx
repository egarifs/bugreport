import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { createStlcDoc } from "./stlc-actions";
import { KIND_LABEL, STATUS_LABEL_STLC } from "@/lib/stlc-labels";
import type { StlcKind } from "@prisma/client";

const input = "px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px] text-sm";
const btn = "px-3 min-h-[44px] rounded text-sm font-bold border border-slate-300 bg-surface hover:bg-slate-50";

export default async function StlcIndex({ params }: { params: Promise<{ key: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const { key } = await params;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, select: { id: true, key: true } });
  if (!project) notFound();
  let actor;
  try { actor = await checkProjectPermission(userId, project.id, "doc.read"); } catch { redirect("/projects"); }
  const canManage = hasPermission(actor.role, "doc.manage", actor.isAdmin);
  const [docs, sprints] = await Promise.all([
    prisma.stlcDoc.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" } }),
    prisma.sprint.findMany({ where: { projectId: project.id }, orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
  ]);
  const kinds = Object.keys(KIND_LABEL) as StlcKind[];
  const create = createStlcDoc.bind(null, project.id, project.key);

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="p-6 space-y-8 max-w-4xl">
        <header>
          <h1 className="text-lg font-semibold text-slate-900">Rencana uji, laporan uji & release notes</h1>
          <p className="text-xs text-slate-500">Melengkapi dokumen requirement. <Link className="underline" href={`/projects/${project.key}/rtm`}>Matriks keterlacakan (RTM)</Link></p>
        </header>
        {kinds.map((k) => {
          const list = docs.filter((d) => d.kind === k);
          return (
            <section key={k} className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900">{KIND_LABEL[k].group}</h2>
              {list.length ? (
                <ul className="bg-surface border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {list.map((d) => (
                    <li key={d.id}><Link href={`/projects/${project.key}/stlc/${d.id}`} className="flex items-center justify-between gap-3 px-4 min-h-[44px] hover:bg-slate-50 text-sm">
                      <span className="font-bold text-slate-900">{d.title}</span><span className="text-xs text-slate-600">{STATUS_LABEL_STLC[d.kind][d.status]}</span>
                    </Link></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">Belum ada.</p>}
              {canManage && (
                <form action={create} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="kind" value={k} />
                  <label className="text-xs font-bold text-slate-700 flex flex-col gap-1">Judul<input name="title" required maxLength={120} placeholder={KIND_LABEL[k].placeholder} className={input} /></label>
                  {k !== "TEST_SUMMARY" && <label className="text-xs font-bold text-slate-700 flex flex-col gap-1">Versi rilis<input name="releaseVersion" required={k === "RELEASE_NOTES"} maxLength={40} placeholder="1.8.0" className={input} /></label>}
                  {k === "TEST_SUMMARY" && <label className="text-xs font-bold text-slate-700 flex flex-col gap-1">Sprint<select name="sprintId" required className={input}>{sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
                  <button className={btn}>Buat {KIND_LABEL[k].short}</button>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
