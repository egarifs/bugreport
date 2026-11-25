import { BugSeverity, BugStatus, type Prisma } from "@prisma/client";

// Pure query rules for the project bug list: URL params in, validated filters and Prisma input out.
// No database access here so the rules stay unit-testable.

export const PAGE_SIZE = 25;
export const UNASSIGNED = "none";
export const DONE_STATUSES: BugStatus[] = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];

export type BugListView = "review" | "mine" | "all";

export type BugListFilters = {
  view: BugListView;
  q?: string;
  status?: BugStatus;
  severity?: BugSeverity;
  moduleId?: string;
  sprintId?: string;
  assigneeId?: string; // user id, or UNASSIGNED
  reporterId?: string;
  page: number;
};

export type BugListRawParams = Partial<Record<
  "view" | "q" | "status" | "severity" | "module" | "sprint" | "assignee" | "reporter" | "page",
  string
>>;

const ID_MAX = 64;
const Q_MAX = 100;

const pickEnum = <T extends string>(values: readonly T[], v?: string): T | undefined =>
  values.find((x) => x === v);

const cleanId = (v?: string) => {
  const s = v?.trim();
  return s && s.length <= ID_MAX ? s : undefined;
};

export function parseBugListFilters(raw: BugListRawParams, defaultView: BugListView): BugListFilters {
  const page = Number.parseInt(raw.page ?? "", 10);
  return {
    view: pickEnum(["review", "mine", "all"] as const, raw.view) ?? defaultView,
    q: raw.q?.trim().slice(0, Q_MAX) || undefined,
    status: pickEnum(Object.values(BugStatus), raw.status),
    severity: pickEnum(Object.values(BugSeverity), raw.severity),
    moduleId: cleanId(raw.module),
    sprintId: cleanId(raw.sprint),
    assigneeId: cleanId(raw.assignee),
    reporterId: cleanId(raw.reporter),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

// True when the user narrowed the list beyond the tab itself (drives "reset" and empty-state copy).
export function isFiltered(f: BugListFilters): boolean {
  return Boolean(f.q || f.status || f.severity || f.moduleId || f.sprintId || f.assigneeId || f.reporterId);
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
  if (f.status) and.push({ status: f.status });
  if (f.severity) and.push({ severity: f.severity });
  if (f.moduleId) and.push({ moduleId: f.moduleId });
  if (f.sprintId) and.push({ sprintId: f.sprintId });
  if (f.reporterId) and.push({ reporterId: f.reporterId });
  if (f.assigneeId) {
    and.push(
      f.assigneeId === UNASSIGNED
        ? { assigneeId: null, bugAssignees: { none: {} } }
        : { OR: [{ assigneeId: f.assigneeId }, { bugAssignees: { some: { userId: f.assigneeId } } }] },
    );
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
  const base: Record<string, string | undefined> = {
    view: f.view,
    q: f.q,
    status: f.status,
    severity: f.severity,
    module: f.moduleId,
    sprint: f.sprintId,
    assignee: f.assigneeId,
    reporter: f.reporterId,
    page: f.page > 1 ? String(f.page) : undefined,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  const qs = p.toString();
  return `/projects/${projectKey}${qs ? `?${qs}` : ""}`;
}
