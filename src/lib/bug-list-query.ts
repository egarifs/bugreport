import { BugPriority, BugSeverity, BugStatus, type Prisma } from "@prisma/client";
import { BOARD_PAGE, boardLimit, parseHiddenColumns } from "./bug-board";

// Pure query rules for the project bug list: URL params in, validated filters and Prisma input out.
// No database access here so the rules stay unit-testable.

export const PAGE_SIZE = 25;
export const UNASSIGNED = "none";
export const DONE_STATUSES: BugStatus[] = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];

export type BugListView = "review" | "mine" | "all";

export type BugLayout = "list" | "board";

export type BugListFilters = {
  view: BugListView;
  layout: BugLayout;
  cols: number; // board cards loaded per column
  hide: string[]; // board column ids the user hid
  q?: string;
  // Multi-select filters: values within one filter are ORed, different filters are ANDed.
  status: BugStatus[];
  severity: BugSeverity[];
  priority: BugPriority[];
  moduleIds: string[];
  sprintIds: string[];
  assigneeIds: string[]; // user ids, or UNASSIGNED
  reporterIds: string[];
  tagIds: string[];
  page: number;
};

export type BugListRawParams = Partial<Record<
  "view" | "layout" | "cols" | "hide" | "q" | "status" | "severity" | "priority" | "module" | "sprint" | "assignee" | "reporter" | "tag" | "page",
  string
>>;

const ID_MAX = 64;
const Q_MAX = 100;
const LIST_MAX = 50;

const pickEnum = <T extends string>(values: readonly T[], v?: string): T | undefined =>
  values.find((x) => x === v);

// "a,b,c" -> unique, validated values (unknown ones dropped, list capped).
const csv = (v?: string): string[] => [...new Set((v ?? "").split(",").map((x) => x.trim()).filter(Boolean))].slice(0, LIST_MAX);
const enumList = <T extends string>(values: readonly T[], v?: string): T[] =>
  csv(v).map((x) => pickEnum(values, x)).filter((x): x is T => Boolean(x));
const idList = (v?: string): string[] => csv(v).filter((x) => x.length <= ID_MAX);

export function parseBugListFilters(raw: BugListRawParams, defaultView: BugListView): BugListFilters {
  const page = Number.parseInt(raw.page ?? "", 10);
  const layout = pickEnum(["list", "board"] as const, raw.layout) ?? "list";
  return {
    // The board spans every status, so it defaults to the "all" tab instead of the role's landing queue.
    view: pickEnum(["review", "mine", "all"] as const, raw.view) ?? (layout === "board" ? "all" : defaultView),
    layout,
    cols: boardLimit(raw.cols),
    hide: parseHiddenColumns(raw.hide),
    q: raw.q?.trim().slice(0, Q_MAX) || undefined,
    status: enumList(Object.values(BugStatus), raw.status),
    severity: enumList(Object.values(BugSeverity), raw.severity),
    priority: enumList(Object.values(BugPriority), raw.priority),
    moduleIds: idList(raw.module),
    sprintIds: idList(raw.sprint),
    assigneeIds: idList(raw.assignee),
    reporterIds: idList(raw.reporter),
    tagIds: idList(raw.tag),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

// Every narrowing filter cleared (tab, layout and paging are the caller's business).
export function emptyFilters(): Pick<BugListFilters, "q" | "status" | "severity" | "priority" | "moduleIds" | "sprintIds" | "assigneeIds" | "reporterIds" | "tagIds" | "page"> {
  return { q: undefined, status: [], severity: [], priority: [], moduleIds: [], sprintIds: [], assigneeIds: [], reporterIds: [], tagIds: [], page: 1 };
}

// True when the user narrowed the list beyond the tab itself (drives "reset" and empty-state copy).
export function isFiltered(f: BugListFilters): boolean {
  return Boolean(
    f.q || f.status.length || f.severity.length || f.priority.length ||
    f.moduleIds.length || f.sprintIds.length || f.assigneeIds.length || f.reporterIds.length || f.tagIds.length,
  );
}

const mineWhere = (userId: string): Prisma.BugWhereInput => ({
  status: { notIn: DONE_STATUSES },
  OR: [{ assigneeId: userId }, { bugAssignees: { some: { userId } } }],
});

export function bugTabWhere(view: BugListView, userId: string): Prisma.BugWhereInput {
  if (view === "review") return { status: "DRAFT" };
  if (view === "mine") return mineWhere(userId);
  return {};
}

// Every clause is ANDed so the tab, filters and search can never override each other.
export function buildBugWhere(f: BugListFilters, ctx: { projectId: string; userId: string }): Prisma.BugWhereInput {
  const and: Prisma.BugWhereInput[] = [bugTabWhere(f.view, ctx.userId)];
  if (f.status.length) and.push({ status: { in: f.status } });
  if (f.severity.length) and.push({ severity: { in: f.severity } });
  if (f.priority.length) and.push({ priority: { in: f.priority } });
  if (f.moduleIds.length) and.push({ moduleId: { in: f.moduleIds } });
  if (f.sprintIds.length) and.push({ sprintId: { in: f.sprintIds } });
  if (f.reporterIds.length) and.push({ reporterId: { in: f.reporterIds } });
  if (f.tagIds.length) and.push({ tags: { some: { id: { in: f.tagIds } } } });
  if (f.assigneeIds.length) {
    const users = f.assigneeIds.filter((id) => id !== UNASSIGNED);
    const or: Prisma.BugWhereInput[] = [];
    if (users.length) or.push({ assigneeId: { in: users } }, { bugAssignees: { some: { userId: { in: users } } } });
    if (users.length < f.assigneeIds.length) or.push({ assigneeId: null, bugAssignees: { none: {} } });
    and.push({ OR: or });
  }
  if (f.q) {
    and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { key: { contains: f.q, mode: "insensitive" } }] });
  }
  return { projectId: ctx.projectId, AND: and };
}

// Enum order in Postgres is BLOCKER..LOW, so asc puts the most severe first; then oldest first.
export function bugOrderBy(view: BugListView): Prisma.BugOrderByWithRelationInput[] {
  return view === "all" ? [{ createdAt: "desc" }] : [{ severity: "asc" }, { createdAt: "asc" }];
}

export function pageWindow(page: number, total: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const skip = (current - 1) * size;
  return { current, pages, skip, take: size, from: total === 0 ? 0 : skip + 1, to: Math.min(total, skip + size) };
}

// Builds a list URL from the current filters plus overrides (undefined/empty removes a param).
export function bugListHref(projectKey: string, f: BugListFilters, over: Record<string, string | undefined> = {}): string {
  const qs = bugListQuery(f, over);
  return `/projects/${projectKey}${qs ? `?${qs}` : ""}`;
}

export function bugListQuery(f: BugListFilters, over: Record<string, string | undefined> = {}): string {
  const base: Record<string, string | undefined> = {
    view: f.view,
    layout: f.layout === "board" ? "board" : undefined,
    q: f.q,
    status: f.status.join(","),
    severity: f.severity.join(","),
    priority: f.priority.join(","),
    module: f.moduleIds.join(","),
    sprint: f.sprintIds.join(","),
    assignee: f.assigneeIds.join(","),
    reporter: f.reporterIds.join(","),
    tag: f.tagIds.join(","),
    page: f.page > 1 ? String(f.page) : undefined,
    cols: f.cols > BOARD_PAGE ? String(f.cols) : undefined,
    hide: f.layout === "board" ? f.hide.join(",") : undefined,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  return p.toString();
}

// Saved views store only what the parser accepts, minus paging: a stored string can never smuggle other params.
export function sanitizeViewQuery(query: string): string {
  const raw = Object.fromEntries(new URLSearchParams(query)) as BugListRawParams;
  return bugListQuery(parseBugListFilters(raw, "all"), { page: undefined, cols: undefined, hide: undefined });
}

// Prefix for selection links ("...?view=all&sel="): the caller appends an encoded bug key.
export function bugListSelectionBase(projectKey: string, f: BugListFilters): string {
  const href = bugListHref(projectKey, f, { sel: undefined });
  return `${href}${href.includes("?") ? "&" : "?"}sel=`;
}
