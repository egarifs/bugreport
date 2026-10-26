import { BugStatus, ProjectRole } from "@prisma/client";

export type Permission =
  | "user.review"
  | "project.manage"
  | "project.read"
  | "bug.create"
  | "bug.review"
  | "bug.update"
  | "bug.close"
  | "bug.reopen"
  | "bug.comment"
  | "note.internal.read"
  | "doc.manage"
  | "doc.read"
  | "testcase.manage"
  | "testcase.read"
  | "testrun.execute"
  | "chat.ask";

export const ROLE_PERMISSIONS: Record<ProjectRole, readonly Permission[]> = {
  ADMIN: [
    "user.review",
    "project.manage",
    "project.read",
    "bug.create",
    "bug.review",
    "bug.update",
    "bug.close",
    "bug.reopen",
    "bug.comment",
    "note.internal.read",
    "doc.manage",
    "doc.read",
    "testcase.manage",
    "testcase.read",
    "testrun.execute",
    "chat.ask",
  ],
  QA: [
    "project.read",
    "bug.create",
    "bug.review",
    "bug.update",
    "bug.close",
    "bug.reopen",
    "bug.comment",
    "note.internal.read",
    "doc.manage",
    "doc.read",
    "testcase.manage",
    "testcase.read",
    "testrun.execute",
    "chat.ask",
  ],
  DEVELOPER: [
    "project.read",
    "bug.create",
    "bug.update",
    "bug.comment",
    "note.internal.read",
    "doc.read",
    "testcase.read",
    "testrun.execute",
    "chat.ask",
  ],
  VENDOR: [
    "project.read",
    "bug.create",
    "bug.update",
    "bug.comment",
    "doc.read",
    "testcase.read",
    "chat.ask",
  ],
  CLIENT: [
    "project.read",
    "bug.create",
    "bug.reopen",
    "bug.comment",
    "doc.read",
    "testcase.read",
    "chat.ask",
  ],
  VIEWER: [
    "project.read",
    "doc.read",
    "testcase.read",
    "chat.ask",
  ],
} as const;

export function hasPermission(
  role: ProjectRole | null | undefined,
  permission: Permission,
  isAdminUser = false
): boolean {
  if (isAdminUser) return true;
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export interface TransitionRule {
  allowedTargets: readonly BugStatus[];
  requiredPermission: Permission;
}

export const BUG_TRANSITIONS: Record<BugStatus, readonly { to: BugStatus; permission: Permission }[]> = {
  DRAFT: [
    { to: "OPEN", permission: "bug.review" },
    { to: "INVALID", permission: "bug.review" },
    { to: "DUPLICATE", permission: "bug.review" },
    { to: "CANNOT_REPRODUCE", permission: "bug.review" },
  ],
  OPEN: [
    { to: "IN_PROGRESS", permission: "bug.update" },
    { to: "WONT_FIX", permission: "bug.update" },
  ],
  REOPENED: [
    { to: "IN_PROGRESS", permission: "bug.update" },
    { to: "WONT_FIX", permission: "bug.update" },
  ],
  IN_PROGRESS: [
    { to: "READY_FOR_VERIFICATION", permission: "bug.update" },
    { to: "OPEN", permission: "bug.update" },
  ],
  READY_FOR_VERIFICATION: [
    { to: "CLOSED", permission: "bug.close" },
    { to: "IN_PROGRESS", permission: "bug.update" },
  ],
  CLOSED: [
    { to: "REOPENED", permission: "bug.reopen" },
  ],
  INVALID: [],
  DUPLICATE: [],
  CANNOT_REPRODUCE: [
    { to: "OPEN", permission: "bug.review" },
  ],
  WONT_FIX: [
    { to: "OPEN", permission: "bug.review" },
  ],
};

export function canTransitionBug(
  current: BugStatus,
  target: BugStatus,
  role: ProjectRole | null | undefined,
  isAdminUser = false
): { allowed: boolean; reason?: string } {
  if (current === target) {
    return { allowed: true };
  }
  const rules = BUG_TRANSITIONS[current] ?? [];
  const rule = rules.find((r) => r.to === target);
  if (!rule) {
    return {
      allowed: false,
      reason: `Transition from ${current} to ${target} is not permitted`,
    };
  }
  if (!hasPermission(role, rule.permission, isAdminUser)) {
    return {
      allowed: false,
      reason: `Missing permission '${rule.permission}' for transition to ${target}`,
    };
  }
  return { allowed: true };
}
