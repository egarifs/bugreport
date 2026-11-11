import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "./db";
import { AGENT_QA_SCOPES, generateApiKey } from "./mcp-auth";
import { POST } from "../app/api/mcp/route";

test("AC-AG-02 /api/mcp answers initialize, notifications/initialized, ping, tools/list", async () => {
  const project = await prisma.project.create({ data: { key: `MT${Date.now().toString().slice(-5)}`, name: "Transport" } });
  const user = await prisma.user.create({ data: { email: `mt_${Date.now()}@example.com`, status: "ACTIVE" } });
  const k = generateApiKey();
  await prisma.apiKey.create({ data: { projectId: project.id, name: "t", keyHash: k.keyHash, keyPrefix: k.keyPrefix, scopes: AGENT_QA_SCOPES, preset: "AGENT_QA", createdById: user.id } });
  const call = (body: object) =>
    POST(new NextRequest("http://x/api/mcp", { method: "POST", headers: { authorization: `Bearer ${k.rawKey}` }, body: JSON.stringify(body) }));

  const init = await (await call({ jsonrpc: "2.0", id: 1, method: "initialize" })).json();
  assert.equal(init.result.serverInfo.name, "bugreport-mcp-server");
  const note = await call({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(note.status, 202);
  assert.equal(await note.text(), "");
  assert.deepEqual((await (await call({ jsonrpc: "2.0", id: 2, method: "ping" })).json()).result, {});
  assert.ok((await (await call({ jsonrpc: "2.0", id: 3, method: "tools/list" })).json()).result.tools.length > 0);
  await prisma.project.delete({ where: { id: project.id } });
});
