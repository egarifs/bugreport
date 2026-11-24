import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { sectionDor } from "@/lib/requirement-service";
import { REQ_STATUS_LABEL } from "@/lib/requirement-labels";
import { updateSection } from "../rtm-actions";

const STEPS = ["APPROVED", "READY", "IN_SPRINT", "DEV_DONE", "VERIFIED"] as const;
const btn = "px-3 min-h-[44px] rounded text-sm font-bold border border-slate-300 bg-surface hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
const input = "px-2 py-1.5 border border-slate-300 rounded bg-surface min-h-[44px] text-sm";

export default async function SectionPage({ params }: { params: Promise<{ key: string; sectionId: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const { key, sectionId } = await params;
  const found = await sectionDor(sectionId);
  if (!found) notFound();
  const { section, dor } = found;
  const doc = await prisma.businessDoc.findUnique({ where: { id: section.docId }, select: { title: true, projectId: true, project: { select: { key: true } } } });
  if (!doc || doc.project.key !== key.toUpperCase()) notFound();
  let actor;
  try { actor = await checkProjectPermission(userId, doc.projectId, "doc.read"); } catch { redirect("/projects"); }
  const canManage = hasPermission(actor.role, "doc.manage", actor.isAdmin);

  const [modules, sprints, linked, candidates] = await Promise.all([
    prisma.module.findMany({ where: { projectId: doc.projectId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.sprint.findMany({ where: { projectId: doc.projectId }, orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
    prisma.testCase.findMany({ where: { sectionId }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
    prisma.testCase.findMany({ where: { projectId: doc.projectId, sectionId: null, status: { not: "DEPRECATED" } }, orderBy: { code: "asc" }, take: 200, select: { id: true, code: true, title: true } }),
  ]);
  const act = (op: Parameters<typeof updateSection>[1]) => updateSection.bind(null, sectionId, op);
  const idx = STEPS.indexOf(section.status);
  const missingTc = !dor.items[3].ok;

  return (
    <AppShell activeProjectKey={doc.project.key}>
      <div className="p-6 max-w-3xl space-y-6">
        <nav className="text-xs"><Link className="underline" href={`/projects/${doc.project.key}/rtm`}>← Matriks keterlacakan</Link></nav>
        <header>
          <p className="text-xs text-slate-500">{doc.title}</p>
          <h1 className="text-lg font-semibold text-slate-900">{section.title}</h1>
          <ol aria-label="Status requirement" className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={s === section.status ? "step" : undefined} className={`px-2.5 py-1 rounded border ${s === section.status ? "border-ink bg-ink text-white font-bold" : i < idx ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-500"}`}>{REQ_STATUS_LABEL[s]}</li>
            ))}
          </ol>
        </header>

        <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Kriteria penerimaan</h2>
          {section.acceptanceCriteria.length ? <ul className="list-disc pl-5 text-sm space-y-1">{section.acceptanceCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p className="text-sm text-slate-500">Belum ada kriteria.</p>}
          {canManage && (
            <form action={act("criterion")} className="flex gap-2">
              <label htmlFor="crit" className="sr-only">Kriteria baru</label>
              <input id="crit" name="value" maxLength={500} required placeholder="+ Kriteria" className={`${input} flex-1`} />
              <button className={btn}>Tambah</button>
            </form>
          )}
        </section>

        <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Modul terdampak & sprint</h2>
          {canManage ? (
            <div className="flex flex-wrap gap-4">
              <form action={act("module")} className="flex gap-2 items-center">
                <label htmlFor="mod" className="text-xs text-slate-600">Modul</label>
                <select id="mod" name="value" defaultValue={section.moduleId ?? ""} className={input}><option value="">—</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <button className={btn}>Simpan</button>
              </form>
              <form action={act("sprint")} className="flex gap-2 items-center">
                <label htmlFor="spr" className="text-xs text-slate-600">Sprint</label>
                <select id="spr" name="value" defaultValue={section.sprintId ?? ""} className={input}><option value="">—</option>{sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <button className={btn}>Simpan</button>
              </form>
            </div>
          ) : <p className="text-sm text-slate-600">Modul: {modules.find((m) => m.id === section.moduleId)?.name ?? "—"} · Sprint: {sprints.find((s) => s.id === section.sprintId)?.name ?? "—"}</p>}
        </section>

        <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Test case</h2>
          {linked.length ? (
            <ul className="text-sm space-y-1">{linked.map((t) => (
              <li key={t.id} className="flex items-center gap-2"><Link className="underline" href={`/projects/${doc.project.key}/test-cases/${t.id}`}>{t.code}</Link><span className="flex-1 truncate">{t.title}</span>
                {canManage && <form action={act("unlink")}><input type="hidden" name="value" value={t.id} /><button className="text-xs underline min-h-[32px]">Lepas</button></form>}
              </li>))}</ul>
          ) : <p className="text-sm text-slate-500">Belum ada test case yang merujuk bagian ini.</p>}
          {canManage && candidates.length > 0 && (
            <form action={act("link")} className="flex gap-2">
              <label htmlFor="tc" className="sr-only">Kaitkan test case</label>
              <select id="tc" name="value" className={`${input} flex-1 min-w-0`}>{candidates.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.title}</option>)}</select>
              <button className={btn}>Kaitkan</button>
            </form>
          )}
        </section>

        <section className="bg-surface border border-slate-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Definition of Ready</h2>
          <ul className="text-sm space-y-1">{dor.items.map((i) => <li key={i.label}><span aria-hidden>{i.ok ? "✓" : "○"}</span> <span className="sr-only">{i.ok ? "Terpenuhi:" : "Belum:"}</span>{i.label}</li>)}</ul>
          {canManage && (
            <div className="flex flex-wrap gap-2 items-center">
              <form action={act("ready")}><button className={btn} disabled={!dor.ready || section.status !== "APPROVED"}>Tandai Siap dikembangkan</button></form>
              <form action={act("devdone")}><button className={btn} disabled={section.status !== "IN_SPRINT" && section.status !== "READY"}>Tandai Selesai dikembangkan</button></form>
            </div>
          )}
          {!dor.ready && <p className="text-xs text-slate-600">Belum bisa: {dor.items.filter((i) => !i.ok).map((i) => i.label.toLowerCase()).join("; ")}.{missingTc && canManage ? " Kaitkan test case di atas." : ""}</p>}
          <p className="text-xs text-slate-500">Di sprint otomatis saat dikaitkan ke sprint; Terverifikasi otomatis saat semua test case lolos dan tanpa bug terbuka.</p>
        </section>
      </div>
    </AppShell>
  );
}
