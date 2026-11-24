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
  | "doc.approve"
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
    "doc.approve",
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
    "testrun.execute",
    "chat.ask",
  ],
  // Client/Viewer: no AI chat (chat reads all project bugs) and no test cases (internal QA work).
  CLIENT: [
    "project.read",
    "bug.create",
    "bug.reopen",
    "bug.comment",
    "doc.read",
  ],
  VIEWER: [
    "project.read",
    "doc.read",
  ],
} as const;

// In-memory cache for dynamic DB role permissions
let dbRolePermissionsCache: Record<string, boolean> | null = null;

export function invalidateRolePermissionCache() {
  dbRolePermissionsCache = null;
}

export function syncRolePermissionsCache(records: { role: ProjectRole; permission: string; enabled: boolean }[]) {
  const map: Record<string, boolean> = {};
  for (const r of records) {
    map[`${r.role}:${r.permission}`] = r.enabled;
  }
  dbRolePermissionsCache = map;
}

export function hasPermission(
  role: ProjectRole | null | undefined,
  permission: Permission,
  isAdminUser = false
): boolean {
  if (isAdminUser) return true;
  if (!role) return false;

  // Check dynamic DB override if cached
  if (dbRolePermissionsCache) {
    const override = dbRolePermissionsCache[`${role}:${permission}`];
    if (typeof override === "boolean") return override;
  }

  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function loadRolePermissions(): Promise<Record<ProjectRole, Permission[]>> {
  const { prisma } = await import("@/lib/db");
  const records = await prisma.rolePermission.findMany();
  syncRolePermissionsCache(records);

  const roles = Object.values(ProjectRole);
  const result = {} as Record<ProjectRole, Permission[]>;

  for (const r of roles) {
    const defaults = ROLE_PERMISSIONS[r] || [];
    const perms: Permission[] = [];
    for (const p of ROLE_PERMISSIONS.ADMIN) {
      const key = `${r}:${p}`;
      const has = dbRolePermissionsCache && typeof dbRolePermissionsCache[key] === "boolean"
        ? dbRolePermissionsCache[key]
        : defaults.includes(p);
      if (has) perms.push(p);
    }
    result[r] = perms;
  }
  return result;
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
    { to: "DESIGN_REVIEW", permission: "bug.update" },
    { to: "WONT_FIX", permission: "bug.update" },
  ],
  REOPENED: [
    { to: "IN_PROGRESS", permission: "bug.update" },
    { to: "DESIGN_REVIEW", permission: "bug.update" },
    { to: "WONT_FIX", permission: "bug.update" },
  ],
  IN_PROGRESS: [
    { to: "READY_FOR_VERIFICATION", permission: "bug.update" },
    { to: "DESIGN_REVIEW", permission: "bug.update" },
    { to: "OPEN", permission: "bug.update" },
  ],
  DESIGN_REVIEW: [
    { to: "OPEN", permission: "bug.update" },
    { to: "IN_PROGRESS", permission: "bug.update" },
    { to: "READY_FOR_VERIFICATION", permission: "bug.update" },
  ],
  READY_FOR_VERIFICATION: [
    { to: "CLOSED", permission: "bug.close" },
    { to: "REOPENED", permission: "bug.close" }, // "Masih gagal" at verification (AC-BUG-06)
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
