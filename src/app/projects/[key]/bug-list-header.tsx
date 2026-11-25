import Link from "next/link";
import { BugImportModal } from "./bugs/import/bug-import-modal";
import { importBugsAction, previewImportAction } from "./bug-list-actions";

export function BugListHeader({ projectKey, projectName, role, canCreate }: {
  projectKey: string; projectName: string; role: string; canCreate: boolean;
}) {
  return (
    <header className="bg-surface border-b border-slate-200/80 px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-xs">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="font-semibold text-slate-900 text-sm tracking-tight truncate">{projectName}</h1>
        <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded">{role}</span>
      </div>
      {canCreate && (
        <div className="flex items-center gap-2">
          <BugImportModal importAction={importBugsAction.bind(null, projectKey)} previewAction={previewImportAction} projectKey={projectKey} />
          <Link
            href={`/projects/${projectKey}/bugs/new`}
            className="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            + Laporkan bug
          </Link>
        </div>
      )}
    </header>
  );
}
