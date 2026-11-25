import Link from "next/link";
import { BugPriority, BugSeverity, BugStatus } from "@prisma/client";
import { SEVERITY_STYLE, STATUS_LABEL } from "@/components/ui/bug-badges";
import { bugListHref, emptyFilters, type BugListFilters, type BugListView } from "@/lib/bug-list-query";
import type { BugListData } from "@/lib/bug-list-service";
import { FilterMenu, type FilterCategory } from "./filter-menu";
import { LayoutToggle } from "./layout-toggle";

type Props = {
  projectKey: string;
  userId: string;
  filters: BugListFilters;
  data: Pick<BugListData, "total" | "reviewCount" | "mineCount" | "modules" | "members" | "sprints" | "savedViews" | "tags">;
  canReview: boolean;
  canWork: boolean;
};

const memberName = (m: BugListData["members"][number]) => m.user.name || m.user.email;

// Filter menu categories live in one table so a new filter is one more row here and one in bug-list-query.
function categories(userId: string, d: Props["data"]): FilterCategory[] {
  return [
    { param: "assignee", label: "Assignee", options: d.members.map((m) => ({ value: m.userId, label: memberName(m) + (m.userId === userId ? " (Saya)" : "") })) },
    { param: "reporter", label: "Dilaporkan oleh", options: d.members.map((m) => ({ value: m.userId, label: memberName(m) })) },
    { param: "severity", label: "Severity", options: Object.values(BugSeverity).map((v) => ({ value: v, label: SEVERITY_STYLE[v].label })) },
    { param: "priority", label: "Priority", options: Object.values(BugPriority).map((v) => ({ value: v, label: v })) },
    { param: "status", label: "Status", options: Object.values(BugStatus).map((v) => ({ value: v, label: STATUS_LABEL[v] })) },
    { param: "module", label: "Modul", options: d.modules.map((m) => ({ value: m.id, label: m.name })) },
    { param: "tag", label: "Tag", options: d.tags.map((t) => ({ value: t.id, label: `#${t.name}` })) },
    { param: "sprint", label: "Sprint", options: d.sprints.map((x) => ({ value: x.id, label: x.name })) },
  ];
}

export function BugListToolbar({ projectKey, userId, filters, data, canReview, canWork }: Props) {
  const tabs: { id: BugListView; label: string; count?: number; show: boolean }[] = [
    { id: "review", label: "Perlu review", count: data.reviewCount, show: canReview },
    { id: "mine", label: "Tugas saya", count: data.mineCount, show: canWork },
    { id: "all", label: "Semua bug", show: true },
  ];
  // Tab links reset filters and paging.
  const tabHref = (v: BugListView) => bugListHref(projectKey, { ...filters, ...emptyFilters(), view: v });
  // The search box submits as GET, so the other active filters travel as hidden inputs.
  const carried = {
    view: filters.view, layout: filters.layout, status: filters.status.join(","), severity: filters.severity.join(","),
    priority: filters.priority.join(","), module: filters.moduleIds.join(","), sprint: filters.sprintIds.join(","),
    assignee: filters.assigneeIds.join(","), reporter: filters.reporterIds.join(","), tag: filters.tagIds.join(","),
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      <nav aria-label="Tampilan bug" className="flex items-center gap-1 border-b border-slate-200 text-xs font-medium overflow-x-auto">
        {tabs.filter((t) => t.show).map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            aria-current={filters.view === t.id ? "page" : undefined}
            className={`px-3 py-2 -mb-px border-b-2 whitespace-nowrap transition-colors ${
              filters.view === t.id ? "border-slate-900 text-slate-900 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filters.view === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{t.count}</span>
            )}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">{data.total} bug</span>
          <LayoutToggle
            current={filters.layout}
            listHref={bugListHref(projectKey, filters, { layout: "list", cols: undefined })}
            boardHref={bugListHref(projectKey, filters, { layout: "board", page: undefined })}
          />
        </span>
      </nav>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <form role="search" className="relative flex-1 min-w-[200px] max-w-md">
          {Object.entries(carried).map(([n, v]) => v && <input key={n} type="hidden" name={n} value={v} />)}
          <label className="sr-only" htmlFor="q">Cari bug</label>
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={`Cari ID (${projectKey}-1) atau judul...`}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md bg-surface text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
          />
          <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </form>
        <FilterMenu meId={userId} projectKey={projectKey} canShare={canReview} savedViews={data.savedViews} categories={categories(userId, data)} />
      </div>
    </div>
  );
}
