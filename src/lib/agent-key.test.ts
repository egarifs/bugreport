import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { AGENT_QA_SCOPES, generateApiKey, verifyApiKey } from "./mcp-auth";

test("AC-AG-01 preset Agent QA scopes + rate limit; revoked key stops at once", async () => {
  assert.ok(AGENT_QA_SCOPES.includes("testrun:execute") && AGENT_QA_SCOPES.includes("bug:create"));
  assert.ok(!AGENT_QA_SCOPES.some((s) => /status|settings|manage|\*/.test(s)));

  const project = await prisma.project.create({ data: { key: `AK${Date.now().toString().slice(-5)}`, name: "Agent key" } });
  const user = await prisma.user.create({ data: { email: `agk_${Date.now()}@example.com`, status: "ACTIVE" } });
  const mk = async (preset: "AGENT_QA" | "CUSTOM") => {
    const k = generateApiKey();
    const row = await prisma.apiKey.create({ data: { projectId: project.id, name: preset, keyHash: k.keyHash, keyPrefix: k.keyPrefix, scopes: AGENT_QA_SCOPES, preset, createdById: user.id } });
    return { raw: k.rawKey, id: row.id, hash: k.keyHash };
  };
  const agent = await mk("AGENT_QA");
  const custom = await mk("CUSTOM");
  const slot = new Date(); slot.setSeconds(0, 0);
  for (const k of [agent, custom]) await prisma.apiKeyRateLimit.create({ data: { keyHash: k.hash, windowSlot: slot, callCount: 30 } });
  assert.equal((await verifyApiKey(custom.raw)).status, 429); // 31st call
  assert.equal((await verifyApiKey(agent.raw)).valid, true); // limit 120

  await prisma.apiKey.update({ where: { id: agent.id }, data: { revokedAt: new Date() } });
  assert.equal((await verifyApiKey(agent.raw)).valid, false);
  await prisma.project.delete({ where: { id: project.id } });
});
