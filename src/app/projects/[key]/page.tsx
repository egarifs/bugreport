import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BugPriority, BugSeverity, BugStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { hasPermission } from "@/lib/permissions";
import { activeModules } from "@/lib/modules";
import { SEVERITY_STYLE, STATUS_LABEL, SeverityBadge, StatusBadge } from "@/components/ui/bug-badges";
import { StatePanel } from "@/components/ui/state-panel";
import { dueLabel } from "@/lib/verify-service";
import { SlaBadge } from "@/components/ui/sla-badge";
import { BugImportModal, type ImportPreview } from "./bugs/import/bug-import-modal";
import { parseMarkdownBugs } from "@/lib/markdown-importer";
import { requireProjectPermission } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { ActionForm, type ActionResult } from "@/components/ui/action-form";
import { triageBug, startOfTodayWib } from "@/lib/triage-service";
import { TriageKeys } from "./triage-keys";
import { BugBoard } from "./bug-board";
import { LayoutToggle } from "./layout-toggle";
import { FilterMenu } from "./filter-menu";
import { loadBoard } from "@/lib/bug-board-service";
import { BOARD_COLUMNS, BOARD_PAGE, dragTargets } from "@/lib/bug-board";
import {
  bugListHref, bugOrderBy, bugTabWhere, buildBugWhere, isFiltered, pageWindow, parseBugListFilters,
  type BugListView as View, type BugListRawParams,
} from "@/lib/bug-list-query";

export default async function ProjectDetailPage({
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
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } } },
  });
  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");

  const role = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canReview = hasPermission(role, "bug.review", user.isAdmin);
  const canWork = hasPermission(role, "bug.update", user.isAdmin);
  const canCreate = hasPermission(role, "bug.create", user.isAdmin);

  const sp = await searchParams;
  // Landing page per role: QA reviews drafts, vendor/dev sees own work, client goes to portal.
  if (role === "CLIENT" && !user.isAdmin) redirect(`/projects/${project.key}/portal`);
  const filters = parseBugListFilters(sp, canReview ? "review" : canWork ? "mine" : "all");
  const { view, q } = filters;
  const base: Prisma.BugWhereInput = { projectId: project.id };
  const listWhere = buildBugWhere(filters, { projectId: project.id, userId: user.id });

  const today = startOfTodayWib();
  const sprints = await prisma.sprint.findMany({ where: { projectId: project.id }, orderBy: { startsAt: "desc" }, select: { id: true, name: true } });
  const isBoard = filters.layout === "board";
  const colLimit = filters.cols;
  const total = await prisma.bug.count({ where: listWhere });
  const win = pageWindow(filters.page, total);
  const boardColumns = isBoard ? await loadBoard(listWhere, colLimit) : [];
  const [reviewCount, mineCount, modules, members, reviewedToday, closedToday, bugs] = await Promise.all([
    prisma.bug.count({ where: { ...base, status: "DRAFT" } }),
    prisma.bug.count({ where: { ...base, ...bugTabWhere("mine", user.id) } }),
    activeModules(project.id),
    prisma.projectMember.findMany({ where: { projectId: project.id }, include: { user: { select: { name: true, email: true } } } }),
    canReview ? prisma.bug.count({ where: { ...base, reviewedAt: { gte: today } } }) : Promise.resolve(0),
    canReview
      ? prisma.auditLog.count({ where: { projectId: project.id, action: "bug.status_change", createdAt: { gte: today }, changes: { path: ["after", "status"], equals: "CLOSED" } } })
      : Promise.resolve(0),
    prisma.bug.findMany({
      where: listWhere,
      orderBy: bugOrderBy(view),
      skip: win.skip,
      take: isBoard ? 0 : win.take,
      include: {
        assignee: { select: { name: true, email: true } },
        module: { select: { name: true } },
        _count: { select: { comments: true, testRunLinks: true } },
      },
    }),
  ]);

  const tabs: { id: View; label: string; count?: number; show: boolean }[] = [
    { id: "review", label: "Perlu review", count: reviewCount, show: canReview },
    { id: "mine", label: "Tugas saya", count: mineCount, show: canWork },
    { id: "all", label: "Semua bug", show: true },
  ];
  // Tab links reset filters and paging; selection links keep both.
  const href = (v: View) => bugListHref(project.key, { ...filters, view: v, q: undefined, status: [], severity: [], priority: [], moduleIds: [], sprintIds: [], assigneeIds: [], reporterIds: [], page: 1 });
  const selHref = (k: string) => bugListHref(project.key, filters, { sel: k });
  const pageHref = (n: number) => bugListHref(project.key, filters, { page: n > 1 ? String(n) : undefined });
  const selected = bugs.find((b) => b.key === sp.sel) ?? null;
  const filtered = isFiltered(filters);
  const bugHref = (n: number) => `/projects/${project.key}/bugs/${n}`;
  const source = (b: (typeof bugs)[number]) => (b.agentRunId ? "Agent" : b._count.testRunLinks ? "Test run" : null);

  const empty =
    filtered ? "Tidak ada bug yang cocok dengan filter ini. Ubah atau reset filter."
    : view === "review" ? "Antrean review kosong. Draft baru dari form, agent, atau test run gagal akan muncul di sini."
    : view === "mine" ? "Tidak ada bug aktif yang ditugaskan ke Anda."
    : "Belum ada bug di project ini.";

  const projectId = project.id;
  const projectKey = project.key;
  const userId = user.id;

  async function handleTriage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const actor = await requireProjectPermission(projectId, "bug.review");
    const intent = formData.get("intent");
    const res = await triageBug(actor, projectId, String(formData.get("bugId")), {
      severity: String(formData.get("severity") ?? ""),
      priority: String(formData.get("priority") ?? ""),
      moduleId: String(formData.get("moduleId") ?? ""),
      assigneeId: String(formData.get("assigneeId") ?? ""),
      accept: intent === "accept",
      reject: intent === "reject",
    });
    revalidatePath(`/projects/${projectKey}`);
    if ("ok" in res && (intent === "accept" || intent === "reject")) {
      redirect(`/projects/${projectKey}?view=review&done=${encodeURIComponent(res.ok!)}`);
    }
    return res;
  }

  async function previewMarkdownBugs(_prev: ImportPreview | null, formData: FormData): Promise<ImportPreview> {
    "use server";
    const target = await prisma.project.findUnique({ where: { key: String(formData.get("projectKey")) }, select: { id: true } });
    if (!target) return { error: "Project tidak ditemukan." };
    const projectId = target.id;
    await requireProjectPermission(projectId, "bug.create");
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Pilih file Markdown (.md)." };
    const parsed = parseMarkdownBugs(await file.text());
    if (parsed.length === 0) return { error: "Tidak ada bug yang terbaca. Cek format tabel / heading file Markdown." };
    const [mods, existing] = await Promise.all([
      activeModules(projectId),
      prisma.bug.findMany({ where: { projectId }, select: { key: true, title: true } }),
    ]);
    const modNames = new Set(mods.map((m) => m.name.toLowerCase()));
    return {
      rows: parsed.map((b) => {
        const area = b.moduleArea?.trim() ?? "";
        const dup = existing.find((e) => e.title.trim().toLowerCase() === b.title.trim().toLowerCase());
        const noModule = area && !modNames.has(area.toLowerCase());
        return {
          title: b.title,
          severity: b.severity,
          module: area || "—",
          status: dup ? "Mirip" : "Siap",
          note: dup ? `Mirip ${dup.key}` : noModule ? "Modul tidak ditemukan, masuk tanpa modul" : "",
        };
      }),
    };
  }

  async function handleImportMarkdownBugs(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    await requireProjectPermission(projectId, "bug.create");
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Pilih file Markdown (.md)." };

    const text = await file.text();
    const parsed = parseMarkdownBugs(text);
    if (parsed.length === 0) return { error: "Tidak ada bug yang terbaca. Cek format tabel / heading file Markdown." };

    const mods = await activeModules(projectId);
    const byName = new Map(mods.map((m) => [m.name.toLowerCase(), m.id]));

    // Sequential bug numbering
    let createdCount = 0;
    for (const b of parsed) {
      const area = b.moduleArea?.trim();
      const moduleId = area ? byName.get(area.toLowerCase()) ?? null : null;

      const lastBug = await prisma.bug.findFirst({
        where: { projectId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const nextNumber = (lastBug?.number ?? 0) + 1;

      await prisma.bug.create({
        data: {
          projectId,
          key: `${projectKey}-${nextNumber}`,
          number: nextNumber,
          title: b.title.slice(0, 200),
          severity: b.severity,
          status: BugStatus.DRAFT,
          reporterId: userId!,
          moduleId,
          stepsToReproduce: b.stepsToReproduce || "-",
          actualResult: b.actualResult || "-",
          expectedResult: b.expectedResult || "-",
        },
      });
      createdCount++;
    }

    revalidatePath(`/projects/${projectKey}`);
    return { ok: `Berhasil mengimpor ${createdCount} bug sebagai Draft.` };
  }

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-surface border-b border-slate-200/80 px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-semibold text-slate-900 text-sm tracking-tight truncate">{project.name}</h1>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
              {role}
            </span>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <BugImportModal importAction={handleImportMarkdownBugs} previewAction={previewMarkdownBugs} projectKey={project.key} />
              <Link
                href={`/projects/${project.key}/bugs/new`}
                className="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
              >
                + Laporkan bug
              </Link>
            </div>
          )}
        </header>

        <main className="p-4 md:p-6 flex-1">
          {sp.done && <p role="status" className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">{sp.done.slice(0, 120)}</p>}
          {canReview && (
            <div aria-label="Ringkasan hari ini" className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 px-3.5 py-2 bg-slate-50/80 border border-slate-200/80 rounded-md text-xs">
              <span className="font-semibold text-slate-900">Hari ini:</span>
              <span className="text-slate-600"><b className="font-mono text-slate-900">{reviewedToday}</b> direview</span>
              <span className="text-slate-600"><b className="font-mono text-slate-900">{closedToday}</b> ditutup</span>
              <span className="ml-auto text-[11px] text-slate-400 font-mono">Reset 00.00 WIB</span>
            </div>
          )}

          {/* Unified Tabs + Search & Filters */}
          <div className="flex flex-col gap-3 mb-4">
            <nav aria-label="Tampilan bug" className="flex items-center gap-1 border-b border-slate-200 text-xs font-medium overflow-x-auto">
              {tabs.filter((t) => t.show).map((t) => (
                <Link
                  key={t.id}
                  href={href(t.id)}
                  aria-current={view === t.id ? "page" : undefined}
                  className={`px-3 py-2 -mb-px border-b-2 whitespace-nowrap transition-colors ${
                    view === t.id
                      ? "border-slate-900 text-slate-900 font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${view === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {t.count}
                    </span>
                  )}
                </Link>
              ))}
              <span className="ml-auto flex items-center gap-3"><span className="text-xs text-slate-400 font-mono">{total} bug</span><LayoutToggle current={filters.layout} listHref={bugListHref(project.key, filters, { layout: "list", cols: undefined })} boardHref={bugListHref(project.key, filters, { layout: "board", page: undefined })} /></span>
            </nav>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <form role="search" className="relative flex-1 min-w-[200px] max-w-md">
                {Object.entries({
                  view, layout: filters.layout, status: filters.status.join(","), severity: filters.severity.join(","),
                  priority: filters.priority.join(","), module: filters.moduleIds.join(","), sprint: filters.sprintIds.join(","),
                  assignee: filters.assigneeIds.join(","), reporter: filters.reporterIds.join(","),
                }).map(([n, v]) => v && <input key={n} type="hidden" name={n} value={v} />)}
                <label className="sr-only" htmlFor="q">Cari bug</label>
                <input
                  id="q"
                  type="search"
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder={`Cari ID (${project.key}-1) atau judul...`}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md bg-surface text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </form>
              <FilterMenu
                meId={userId}
                categories={[
                  { param: "assignee", label: "Assignee", options: members.map((m) => ({ value: m.userId, label: (m.user.name || m.user.email) + (m.userId === userId ? " (Saya)" : "") })) },
                  { param: "reporter", label: "Dilaporkan oleh", options: members.map((m) => ({ value: m.userId, label: m.user.name || m.user.email })) },
                  { param: "severity", label: "Severity", options: Object.values(BugSeverity).map((v) => ({ value: v, label: SEVERITY_STYLE[v].label })) },
                  { param: "priority", label: "Priority", options: Object.values(BugPriority).map((v) => ({ value: v, label: v })) },
                  { param: "status", label: "Status", options: Object.values(BugStatus).map((v) => ({ value: v, label: STATUS_LABEL[v] })) },
                  { param: "module", label: "Modul", options: modules.map((m) => ({ value: m.id, label: m.name })) },
                  { param: "sprint", label: "Sprint", options: sprints.map((x) => ({ value: x.id, label: x.name })) },
                ]}
              />
            </div>
          </div>

          {isBoard ? (
            <BugBoard
              projectKey={project.key}
              columns={boardColumns.map((c) => {
                const def = BOARD_COLUMNS.find((x) => x.id === c.id)!;
                return {
                  ...c,
                  statuses: def.statuses,
                  dropStatus: def.dropStatus,
                  moreHref: bugListHref(project.key, filters, { cols: String(colLimit + BOARD_PAGE) }),
                };
              })}
              allowed={Object.fromEntries(Object.values(BugStatus).map((st) => [st, dragTargets(st, project.members[0]?.role ?? null, Boolean(user.isAdmin))]))}
            />
          ) : bugs.length === 0 ? (
            <StatePanel
              kind={filtered ? "filtered" : "empty"}
              title={filtered ? "Tidak ada bug yang cocok" : view === "review" ? "Antrean bersih" : "Belum ada bug"}
              action={filtered ? { label: "Hapus semua filter", href: href(view) } : view === "review" ? { label: "Tugas saya", href: href("mine") } : canCreate ? { label: "Laporkan bug", href: `/projects/${project.key}/bugs/new` } : undefined}
            >
              {empty}
            </StatePanel>
          ) : (
            <div className="flex flex-wrap items-start gap-5">
            <div className="flex-[999_1_520px] min-w-0">
              {/* Desktop: dense table. Left strip = severity, readable at a glance. */}
              <table className="hidden md:table w-full text-left text-sm bg-surface border border-slate-200 rounded overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th scope="col" className="w-[3px] p-0"><span className="sr-only">Severity</span></th>
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
                    <tr key={b.id} aria-selected={selected?.id === b.id} className={`row-interactive hover:bg-slate-50/80 ${selected?.id === b.id ? "bg-action-soft" : ""}`}>
                      <td className={`p-0 ${SEVERITY_STYLE[b.severity].strip} strip-accent`} />
                      <td className="py-2 px-3 font-bold whitespace-nowrap">
                        <Link href={bugHref(b.number)} className="text-action hover:underline">{b.key}</Link>
                      </td>
                      <td className="py-2 px-3">
                        <Link href={selHref(b.key)} scroll={false} className="text-slate-900 hover:underline">{b.title}</Link>
                        <span className="block text-xs text-slate-500">
                          {[b.module?.name ?? (b.status === "DRAFT" ? "Modul belum diisi" : null), source(b) && `dari ${source(b)}`, b._count.comments > 0 && `${b._count.comments} komentar`]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </td>
                      <td className="py-2 px-3"><SeverityBadge severity={b.severity} /></td>
                      <td className="py-2 px-3"><StatusBadge status={b.status} /></td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[10rem]">{b.assignee?.name || b.assignee?.email || "Belum di-assign"}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {b.dueAt ? (() => { const d = dueLabel(b.dueAt, b.status); return <span className={d.overdue ? "text-bad font-bold" : "text-slate-600"}>{d.text}</span>; })() : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <SlaBadge severity={b.severity} status={b.status} createdAt={b.createdAt} />
                      </td>
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
              {total > win.take && (
                <nav aria-label="Halaman" className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono">{win.from}–{win.to} dari {total}</span>
                  <span className="flex gap-2">
                    {win.current > 1 ? <Link href={pageHref(win.current - 1)} className="px-3 py-1.5 border border-slate-200 rounded-md bg-surface hover:bg-slate-50 font-semibold text-slate-700">Sebelumnya</Link> : <span aria-disabled className="px-3 py-1.5 border border-slate-100 rounded-md text-slate-300">Sebelumnya</span>}
                    {win.current < win.pages ? <Link href={pageHref(win.current + 1)} className="px-3 py-1.5 border border-slate-200 rounded-md bg-surface hover:bg-slate-50 font-semibold text-slate-700">Berikutnya</Link> : <span aria-disabled className="px-3 py-1.5 border border-slate-100 rounded-md text-slate-300">Berikutnya</span>}
                  </span>
                </nav>
              )}
              {canReview && (
                <p className="hidden md:block mt-3 text-xs text-slate-500">
                  <kbd className="px-1 border rounded">J</kbd>/<kbd className="px-1 border rounded">K</kbd> pilih · <kbd className="px-1 border rounded">A</kbd> terima · <kbd className="px-1 border rounded">X</kbd> tolak · <kbd className="px-1 border rounded">↵</kbd> buka detail
                </p>
              )}
            </div>
            {selected && (
              <aside aria-label={`Pratinjau dan triase ${selected.key}`} className="hidden md:flex flex-[1_1_340px] max-w-[440px] min-w-0 flex-col bg-surface border border-slate-200 rounded">
                <div className="p-4 border-b border-slate-100 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-action">{selected.key}</span>
                    <Link href={bugHref(selected.number)} className="text-xs text-action underline">Buka detail</Link>
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm">{selected.title}</h2>
                  <p className="text-xs text-slate-500">{[source(selected) && `Dilaporkan oleh ${source(selected)}`, `${selected._count.comments} komentar`].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="p-4 space-y-3 border-b border-slate-100 text-sm">
                  <div><p className="text-xs font-bold text-sev-blocker">Aktual</p><p className="whitespace-pre-wrap text-slate-800 line-clamp-6">{selected.actualResult}</p></div>
                  <div><p className="text-xs font-bold text-green-700">Diharapkan</p><p className="whitespace-pre-wrap text-slate-800 line-clamp-6">{selected.expectedResult}</p></div>
                </div>
                {canReview && selected.status === "DRAFT" ? (
                  <ActionForm action={handleTriage} className="p-4 space-y-3">
                    <input type="hidden" name="bugId" value={selected.id} />
                    <div className="grid grid-cols-2 gap-3 text-xs font-medium text-slate-700">
                      <label className="space-y-1 block">Severity
                        <select name="severity" defaultValue={selected.severity} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                          {Object.values(BugSeverity).map((v) => <option key={v} value={v}>{SEVERITY_STYLE[v].label}</option>)}
                        </select></label>
                      <label className="space-y-1 block">Priority
                        <select name="priority" defaultValue={selected.priority} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                          {Object.values(BugPriority).map((v) => <option key={v} value={v}>{v}</option>)}
                        </select></label>
                      <label className="space-y-1 block">Modul
                        <select name="moduleId" defaultValue={selected.moduleId ?? ""} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                          <option value="">Pilih modul</option>
                          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select></label>
                      <label className="space-y-1 block">Assignee
                        <select name="assigneeId" defaultValue={selected.assigneeId ?? ""} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
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
            )}
            <TriageKeys
              keys={bugs.map((b) => b.key)}
              selected={selected?.key ?? null}
              basePath={selHref("").replace(/sel=$/, "sel=")}
              detailHref={selected ? bugHref(selected.number) : null}
            />
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
