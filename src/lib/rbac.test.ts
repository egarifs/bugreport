import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, syncRolePermissionsCache, invalidateRolePermissionCache } from "./permissions";

test("RBAC: default permission matrix respects role boundaries", () => {
  invalidateRolePermissionCache();

  // QA can review bugs, Developer cannot
  assert.equal(hasPermission("QA", "bug.review"), true);
  assert.equal(hasPermission("DEVELOPER", "bug.review"), false);

  // Admin user always has full permission
  assert.equal(hasPermission("DEVELOPER", "bug.review", true), true);
  assert.equal(hasPermission(null, "bug.review", true), true);
});

test("RBAC: dynamic DB override takes precedence over defaults", () => {
  invalidateRolePermissionCache();

  // Inject dynamic DB override: give DEVELOPER 'bug.review' = true
  syncRolePermissionsCache([
    { role: "DEVELOPER", permission: "bug.review", enabled: true },
    { role: "QA", permission: "bug.review", enabled: false },
  ]);

  // Now DEVELOPER can review bugs
  assert.equal(hasPermission("DEVELOPER", "bug.review"), true);
  // And QA cannot review bugs
  assert.equal(hasPermission("QA", "bug.review"), false);

  // Invalidate cache: reverts back to defaults
  invalidateRolePermissionCache();
  assert.equal(hasPermission("DEVELOPER", "bug.review"), false);
  assert.equal(hasPermission("QA", "bug.review"), true);
});
