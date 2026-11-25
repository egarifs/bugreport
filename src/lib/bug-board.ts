import type { BugStatus, ProjectRole } from "@prisma/client";
import { BUG_TRANSITIONS, canTransitionBug } from "./permissions";

// Board columns are a registry: add a column here, not a branch elsewhere.
// Each column owns the statuses it shows; `dropStatus` is the status a drop into it sets (null = read-only column).
export type BoardColumn = { id: string; label: string; statuses: BugStatus[]; dropStatus: BugStatus | null };

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  { id: "draft", label: "Draft", statuses: ["DRAFT"], dropStatus: "DRAFT" },
  { id: "open", label: "Open", statuses: ["OPEN"], dropStatus: "OPEN" },
  { id: "in_progress", label: "In progress", statuses: ["IN_PROGRESS"], dropStatus: "IN_PROGRESS" },
  { id: "design_review", label: "Design Review", statuses: ["DESIGN_REVIEW"], dropStatus: "DESIGN_REVIEW" },
  { id: "ready", label: "Ready for QA", statuses: ["READY_FOR_VERIFICATION"], dropStatus: "READY_FOR_VERIFICATION" },
  { id: "reopened", label: "Reopened", statuses: ["REOPENED"], dropStatus: "REOPENED" },
  { id: "closed", label: "Closed", statuses: ["CLOSED"], dropStatus: "CLOSED" },
  { id: "other", label: "Lainnya", statuses: ["INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"], dropStatus: null },
];

export const BOARD_PAGE = 25;
export const BOARD_MAX = 200;

// Moves that need extra input or side effects only the bug detail page collects
// (module gate on Draft, reopen reason, verification build, duplicate link). A drag never performs these.
export function needsDetailPage(from: BugStatus, to: BugStatus): boolean {
  return from === "DRAFT" || to === "REOPENED" || to === "CLOSED" || to === "DUPLICATE";
}

// Statuses a card in `from` may be dragged to for this actor (permission checked here for UI, again on the server).
export function dragTargets(
  from: BugStatus,
  role: ProjectRole | null | undefined,
  isAdmin: boolean,
): BugStatus[] {
  return BUG_TRANSITIONS[from]
    .map((r) => r.to)
    .filter((to) => !needsDetailPage(from, to))
    .filter((to) => BOARD_COLUMNS.some((c) => c.dropStatus === to))
    .filter((to) => canTransitionBug(from, to, role, isAdmin).allowed);
}

export function columnOf(status: BugStatus): BoardColumn {
  return BOARD_COLUMNS.find((c) => c.statuses.includes(status)) ?? BOARD_COLUMNS[BOARD_COLUMNS.length - 1];
}

export function boardLimit(raw?: string): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < BOARD_PAGE) return BOARD_PAGE;
  return Math.min(n, BOARD_MAX);
}
