import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { activeModules, ownModuleId, resolveModuleId } from "./modules";
import { executeMcpTool } from "./mcp-tools";

test("PRD-06 module master list", async (t) => {
  const stamp = Date.now().toString().slice(-5);
  const a = await prisma.project.create({ data: { key: `M6${stamp}`, name: "Modules A" } });
  const b = await prisma.project.create({ data: { key: `N6${stamp}`, name: "Modules B" } });
  const login = await prisma.module.create({ data: { projectId: a.id, name: "Login", sortOrder: 2 } });
  const billing = await prisma.module.create({ data: { projectId: a.id, name: "Billing", sortOrder: 1 } });
  const old = await prisma.module.create({ data: { projectId: a.id, name: "Legacy", archivedAt: new Date() } });
  const other = await prisma.module.create({ data: { projectId: b.id, name: "Login" } });

  try {
    await t.test("active list is ordered and hides archived", async () => {
      assert.deepEqual((await activeModules(a.id)).map((m) => m.name), ["Billing", "Login"]);
    });
    await t.test("resolve by name is case-insensitive, never creates", async () => {
      assert.equal(await resolveModuleId(a.id, "  LOGIN "), login.id);
      assert.equal(await resolveModuleId(a.id, "Checkout"), null);
      assert.equal(await resolveModuleId(a.id, "legacy"), null);
      assert.equal(await prisma.module.count({ where: { projectId: a.id } }), 3);
    });
    await t.test("form moduleId must belong to project and be active", async () => {
      assert.equal(await ownModuleId(a.id, billing.id), billing.id);
      assert.equal(await ownModuleId(a.id, other.id), null);
      assert.equal(await ownModuleId(a.id, old.id), null);
    });
    await t.test("MCP list_modules returns only this project's active names", async () => {
      const r = await executeMcpTool("list_modules", {}, { projectId: a.id, projectKey: a.key, apiKeyId: "x", actorEmail: "a@x", actorId: "x", role: "QA" });
      assert.deepEqual(JSON.parse(r.content[0].text), ["Billing", "Login"]);
    });
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});
