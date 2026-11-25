import Link from "next/link";
import { BugPriority, BugSeverity } from "@prisma/client";
import { SEVERITY_STYLE } from "@/components/ui/bug-badges";
import { ActionForm } from "@/components/ui/action-form";
import type { BugListData, BugListRow } from "@/lib/bug-list-service";
import { bugSource } from "./bug-list-table";
import { triageAction } from "./bug-list-actions";

const SELECT = "w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm";

export function BugPreviewPanel({ projectKey, bug, canReview, modules, members }: {
  projectKey: string;
  bug: BugListRow;
  canReview: boolean;
  modules: BugListData["modules"];
  members: BugListData["members"];
}) {
  const src = bugSource(bug);
  return (
    <aside aria-label={`Pratinjau dan triase ${bug.key}`} className="hidden md:flex flex-[1_1_340px] max-w-[440px] min-w-0 flex-col bg-surface border border-slate-200 rounded">
      <div className="p-4 border-b border-slate-100 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-action">{bug.key}</span>
          <Link href={`/projects/${projectKey}/bugs/${bug.number}`} className="text-xs text-action underline">Buka detail</Link>
        </div>
        <h2 className="font-bold text-slate-900 text-sm">{bug.title}</h2>
        <p className="text-xs text-slate-500">{[src && `Dilaporkan oleh ${src}`, `${bug._count.comments} komentar`].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="p-4 space-y-3 border-b border-slate-100 text-sm">
        <div><p className="text-xs font-bold text-sev-blocker">Aktual</p><p className="whitespace-pre-wrap text-slate-800 line-clamp-6">{bug.actualResult}</p></div>
        <div><p className="text-xs font-bold text-green-700">Diharapkan</p><p className="whitespace-pre-wrap text-slate-800 line-clamp-6">{bug.expectedResult}</p></div>
      </div>
      {canReview && bug.status === "DRAFT" ? (
        <ActionForm action={triageAction.bind(null, projectKey)} className="p-4 space-y-3">
          <input type="hidden" name="bugId" value={bug.id} />
          <div className="grid grid-cols-2 gap-3 text-xs font-medium text-slate-700">
            <label className="space-y-1 block">Severity
              <select name="severity" defaultValue={bug.severity} className={SELECT}>
                {Object.values(BugSeverity).map((v) => <option key={v} value={v}>{SEVERITY_STYLE[v].label}</option>)}
              </select></label>
            <label className="space-y-1 block">Priority
              <select name="priority" defaultValue={bug.priority} className={SELECT}>
                {Object.values(BugPriority).map((v) => <option key={v} value={v}>{v}</option>)}
              </select></label>
            <label className="space-y-1 block">Modul
              <select name="moduleId" defaultValue={bug.moduleId ?? ""} className={SELECT}>
                <option value="">Pilih modul</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>
            <label className="space-y-1 block">Assignee
              <select name="assigneeId" defaultValue={bug.assigneeId ?? ""} className={SELECT}>
                <option value="">Belum di-assign</option>
                {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name || m.user.email}</option>)}
              </select></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button id="triage-accept" type="submit" name="intent" value="accept" className="flex-1 min-w-[120px] px-3 py-2 bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded">Terima</button>
            <button type="submit" name="intent" value="save" className="px-3 py-2 border border-slate-300 bg-surface hover:bg-slate-100 text-sm font-bold rounded">Simpan</button>
            <button id="triage-reject" type="submit" name="intent" value="reject" className="px-3 py-2 border border-slate-300 bg-surface hover:bg-slate-100 text-sm font-bold rounded">Tolak</button>
          </div>
        </ActionForm>
      ) : (
        <p className="p-4 text-xs text-slate-500">{canReview ? "Bug ini sudah ditriase." : "Triase hanya untuk reviewer."} Buka detail untuk aksi lain.</p>
      )}
    </aside>
  );
}
