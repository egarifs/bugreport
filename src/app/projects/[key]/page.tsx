import { notFound, redirect } from "next/navigation";
import { BugStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { StatePanel } from "@/components/ui/state-panel";
import { STATUS_LABEL } from "@/components/ui/bug-badges";
import { hasPermission } from "@/lib/permissions";
import { loadBugListData } from "@/lib/bug-list-service";
import { BOARD_COLUMNS, BOARD_PAGE, dragTargets } from "@/lib/bug-board";
import { bugListHref, bugListSelectionBase, emptyFilters, isFiltered, parseBugListFilters, type BugListRawParams, type BugListView } from "@/lib/bug-list-query";
import { BugListHeader } from "./bug-list-header";
import { BugListToolbar } from "./bug-list-toolbar";
import { BugListTable, BugListPager } from "./bug-list-table";
import { BugPreviewPanel } from "./bug-preview-panel";
import { BugBoard } from "./bug-board";
import { BulkBar } from "./bulk-bar";
import { TriageKeys } from "./triage-keys";

// Statuses a bulk "Ubah status" may target (moves that need extra input stay on the detail page).
const BULK_STATUSES = ["OPEN", "IN_PROGRESS", "DESIGN_REVIEW", "READY_FOR_VERIFICATION", "WONT_FIX"] as const;

const EMPTY_COPY: Record<BugListView, string> = {
  review: "Antrean review kosong. Draft baru dari form, agent, atau test run gagal akan muncul di sini.",
  mine: "Tidak ada bug aktif yang ditugaskan ke Anda.",
  all: "Belum ada bug di project ini.",
};

// Page = authenticate, authorize, load, compose. Data rules live in lib/bug-list-*, views in sibling components.
export default async function ProjectBugsPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<BugListRawParams & { done?: string; sel?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.email || !user.id) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, include: { members: { where: { userId: user.id } } } });
  if (!project) notFound();
  const membership = project.members[0];
  if (!membership && !user.isAdmin) redirect("/projects");

  const role = membership?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  // Clients only see the portal.
  if (role === "CLIENT" && !user.isAdmin) redirect(`/projects/${project.key}/portal`);
  const canReview = hasPermission(role, "bug.review", user.isAdmin);
  const canWork = hasPermission(role, "bug.update", user.isAdmin);
  const canCreate = hasPermission(role, "bug.create", user.isAdmin);

  const sp = await searchParams;
  // Landing tab per role: QA reviews drafts, vendor/dev sees own work.
  const filters = parseBugListFilters(sp, canReview ? "review" : canWork ? "mine" : "all");
  const data = await loadBugListData({ projectId: project.id, userId: user.id, canReview, filters });

  const { bugs, total, win } = data;
  const selected = bugs.find((b) => b.key === sp.sel) ?? null;
  const filtered = isFiltered(filters);
  const resetHref = (v: BugListView) => bugListHref(project.key, { ...filters, ...emptyFilters(), view: v });
  const newBugHref = `/projects/${project.key}/bugs/new`;

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <BugListHeader projectKey={project.key} projectName={project.name} role={role} canCreate={canCreate} />

        <main className="p-4 md:p-6 flex-1">
          {sp.done && <p role="status" className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">{sp.done.slice(0, 120)}</p>}
          {canReview && (
            <div aria-label="Ringkasan hari ini" className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 px-3.5 py-2 bg-slate-50/80 border border-slate-200/80 rounded-md text-xs">
              <span className="font-semibold text-slate-900">Hari ini:</span>
              <span className="text-slate-600"><b className="font-mono text-slate-900">{data.reviewedToday}</b> direview</span>
              <span className="text-slate-600"><b className="font-mono text-slate-900">{data.closedToday}</b> ditutup</span>
              <span className="ml-auto text-[11px] text-slate-400 font-mono">Reset 00.00 WIB</span>
            </div>
          )}

          <BugListToolbar projectKey={project.key} userId={user.id} filters={filters} data={data} canReview={canReview} canWork={canWork} />

          {filters.layout === "board" ? (
            <BugBoard
              projectKey={project.key}
              columns={data.boardColumns.map((c) => {
                const def = BOARD_COLUMNS.find((x) => x.id === c.id)!;
                return { ...c, statuses: def.statuses, dropStatus: def.dropStatus, moreHref: bugListHref(project.key, filters, { cols: String(filters.cols + BOARD_PAGE) }) };
              })}
              allowed={Object.fromEntries(Object.values(BugStatus).map((s) => [s, dragTargets(s, membership?.role ?? null, Boolean(user.isAdmin))]))}
            />
          ) : bugs.length === 0 ? (
            <StatePanel
              kind={filtered ? "filtered" : "empty"}
              title={filtered ? "Tidak ada bug yang cocok" : filters.view === "review" ? "Antrean bersih" : "Belum ada bug"}
              action={
                filtered ? { label: "Hapus semua filter", href: resetHref(filters.view) }
                : filters.view === "review" ? { label: "Tugas saya", href: resetHref("mine") }
                : canCreate ? { label: "Laporkan bug", href: newBugHref }
                : undefined
              }
            >
              {filtered ? "Tidak ada bug yang cocok dengan filter ini. Ubah atau reset filter." : EMPTY_COPY[filters.view]}
            </StatePanel>
          ) : (
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex-[999_1_520px] min-w-0">
                {canWork && (
                  <BulkBar
                    projectKey={project.key}
                    statuses={BULK_STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] }))}
                    members={data.members.map((m) => ({ id: m.userId, label: m.user.name || m.user.email }))}
                  />
                )}
                <BugListTable projectKey={project.key} filters={filters} bugs={bugs} selectedId={selected?.id ?? null} canWork={canWork} />
                <BugListPager projectKey={project.key} filters={filters} win={win} total={total} />
                {canReview && (
                  <p className="hidden md:block mt-3 text-xs text-slate-500">
                    <kbd className="px-1 border rounded">J</kbd>/<kbd className="px-1 border rounded">K</kbd> pilih · <kbd className="px-1 border rounded">A</kbd> terima · <kbd className="px-1 border rounded">X</kbd> tolak · <kbd className="px-1 border rounded">↵</kbd> buka detail
                  </p>
                )}
              </div>
              {selected && <BugPreviewPanel projectKey={project.key} bug={selected} canReview={canReview} modules={data.modules} members={data.members} />}
              <TriageKeys
                keys={bugs.map((b) => b.key)}
                selected={selected?.key ?? null}
                basePath={bugListSelectionBase(project.key, filters)}
                detailHref={selected ? `/projects/${project.key}/bugs/${selected.number}` : null}
              />
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
