import Link from "next/link";
import { SEVERITY_STYLE, SeverityBadge, StatusBadge } from "@/components/ui/bug-badges";
import { SlaBadge } from "@/components/ui/sla-badge";
import { dueLabel } from "@/lib/verify-service";
import { bugListHref, type BugListFilters } from "@/lib/bug-list-query";
import type { BugListRow } from "@/lib/bug-list-service";

export const bugSource = (b: BugListRow) => (b.agentRunId ? "Agent" : b._count.testRunLinks ? "Test run" : null);
const initials = (n: string) => n.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
const CHIP = "px-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600";

function Assignee({ b }: { b: BugListRow }) {
  if (!b.assignee) return <span className="text-slate-400">Belum di-assign</span>;
  const name = b.assignee.name || b.assignee.email;
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span aria-hidden className="w-6 h-6 shrink-0 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold inline-flex items-center justify-center">{initials(name)}</span>
      <span className="truncate">{name}</span>
    </span>
  );
}

function Due({ b }: { b: BugListRow }) {
  if (!b.dueAt) return <span className="text-slate-400">—</span>;
  const d = dueLabel(b.dueAt, b.status);
  return <span className={d.overdue ? "text-bad font-bold" : "text-slate-600"}>{d.text}</span>;
}

function Meta({ b }: { b: BugListRow }) {
  const src = bugSource(b);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      {b.module?.name ? <span className={CHIP}>{b.module.name}</span> : b.status === "DRAFT" ? <span className="text-slate-400">Modul belum diisi</span> : null}
      {b.sprint && <span className={CHIP}>{b.sprint.name}</span>}
      {b.tags.map((t) => <span key={t.name} className="px-1.5 rounded-full border border-slate-200 text-slate-500">#{t.name}</span>)}
      {src && <span>dari {src}</span>}
      {(b._count.comments > 0 || b._count.attachments > 0) && (
        <span className="font-mono" aria-label={`${b._count.comments} komentar, ${b._count.attachments} lampiran`}>💬 {b._count.comments} · 📎 {b._count.attachments}</span>
      )}
    </span>
  );
}

export function BugListTable({ projectKey, filters, bugs, selectedId, canWork }: {
  projectKey: string; filters: BugListFilters; bugs: BugListRow[]; selectedId: string | null; canWork: boolean;
}) {
  const bugHref = (n: number) => `/projects/${projectKey}/bugs/${n}`;
  const selHref = (k: string) => bugListHref(projectKey, filters, { sel: k });
  return (
    <>
      {/* Desktop: dense table. Left strip = severity, readable at a glance. */}
      <table className="hidden md:table w-full text-left text-sm bg-surface border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
          <tr>
            <th scope="col" className="w-[3px] p-0"><span className="sr-only">Severity</span></th>
            {canWork && <th scope="col" className="py-2 pl-3 pr-0 w-8"><input id="bulk-all" type="checkbox" aria-label="Pilih semua bug di halaman ini" /></th>}
            <th scope="col" className="py-2 px-3 w-28 font-bold">ID</th>
            <th scope="col" className="py-2 px-3 font-bold">Judul</th>
            <th scope="col" className="py-2 px-3 w-24 font-bold">Severity</th>
            <th scope="col" className="py-2 px-3 w-40 font-bold">Status</th>
            <th scope="col" className="py-2 px-3 w-40 font-bold">Assignee</th>
            <th scope="col" className="py-2 px-3 w-28 font-bold">Tenggat</th>
            <th scope="col" className="py-2 px-3 w-28 font-bold text-right" title="Target SLA / Batas waktu penyelesaian">SLA / Sisa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {bugs.map((b) => (
            <tr key={b.id} aria-selected={selectedId === b.id} className={`row-interactive hover:bg-slate-50/80 ${selectedId === b.id ? "bg-action-soft" : ""}`}>
              <td className={`p-0 ${SEVERITY_STYLE[b.severity].strip} strip-accent`} />
              {canWork && <td className="py-2 pl-3 pr-0"><input type="checkbox" name="ids" value={b.id} form="bulk-form" aria-label={`Pilih ${b.key}`} /></td>}
              <td className="py-2 px-3 font-bold whitespace-nowrap"><Link href={bugHref(b.number)} className="text-action hover:underline">{b.key}</Link></td>
              <td className="py-2 px-3">
                <Link href={selHref(b.key)} scroll={false} className="text-slate-900 hover:underline">{b.title}</Link>
                <Meta b={b} />
              </td>
              <td className="py-2 px-3"><SeverityBadge severity={b.severity} /></td>
              <td className="py-2 px-3"><StatusBadge status={b.status} /></td>
              <td className="py-2 px-3 text-slate-600 max-w-[10rem]"><Assignee b={b} /></td>
              <td className="py-2 px-3 whitespace-nowrap"><Due b={b} /></td>
              <td className="py-2 px-3 text-right whitespace-nowrap"><SlaBadge severity={b.severity} status={b.status} createdAt={b.createdAt} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: two-line cards for vendors checking their queue. */}
      <ul className="md:hidden space-y-2">
        {bugs.map((b) => (
          <li key={b.id}>
            <Link href={bugHref(b.number)} className="press-snappy flex bg-surface border border-slate-200 hover:border-slate-300 rounded overflow-hidden shadow-xs">
              <span className={`w-[3px] shrink-0 ${SEVERITY_STYLE[b.severity].strip}`} aria-hidden />
              <span className="p-3 min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-action text-sm">{b.key}</span>
                  <SeverityBadge severity={b.severity} />
                  <StatusBadge status={b.status} />
                  <span className="ml-auto shrink-0"><SlaBadge severity={b.severity} status={b.status} createdAt={b.createdAt} compact /></span>
                </span>
                <span className="block text-sm text-slate-900">{b.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function BugListPager({ projectKey, filters, win, total }: {
  projectKey: string; filters: BugListFilters; total: number;
  win: { current: number; pages: number; from: number; to: number; take: number };
}) {
  if (total <= win.take) return null;
  const href = (n: number) => bugListHref(projectKey, filters, { page: n > 1 ? String(n) : undefined });
  const on = "px-3 py-1.5 border border-slate-200 rounded-md bg-surface hover:bg-slate-50 font-semibold text-slate-700";
  const off = "px-3 py-1.5 border border-slate-100 rounded-md text-slate-300";
  return (
    <nav aria-label="Halaman" className="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span className="font-mono">{win.from}–{win.to} dari {total}</span>
      <span className="flex gap-2">
        {win.current > 1 ? <Link href={href(win.current - 1)} className={on}>Sebelumnya</Link> : <span aria-disabled className={off}>Sebelumnya</span>}
        {win.current < win.pages ? <Link href={href(win.current + 1)} className={on}>Berikutnya</Link> : <span aria-disabled className={off}>Berikutnya</span>}
      </span>
    </nav>
  );
}
