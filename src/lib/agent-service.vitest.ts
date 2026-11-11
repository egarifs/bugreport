import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db";
import { saveTestCaseCore } from "./testcase-service";
import { executeMcpTool, McpContext } from "./mcp-tools";
import { AGENT_QA_SCOPES, generateApiKey, verifyApiKey } from "./mcp-auth";

const key = `AGS${Date.now().toString(36).toUpperCase()}`.slice(0, 10);
let projectId: string, userId: string, ctx: McpContext, ctx2: McpContext, runId: string, rawKey: string, keyId: string;
const call = async (name: string, args: object, c = ctx) => {
  const r = await executeMcpTool(name, args as Record<string, unknown>, c);
  return { ...JSON.parse(r.content[0].text), isError: r.isError ?? false };
};

beforeAll(async () => {
  const u = await prisma.user.create({ data: { email: `ags_${Date.now()}@example.com`, name: "Ega", status: "ACTIVE" } });
  userId = u.id;
  const p = await prisma.project.create({ data: { key, name: "Agent svc", isTest: true } });
  projectId = p.id;
  const mk = async (n: string) => {
    const k = generateApiKey();
    const row = await prisma.apiKey.create({ data: { projectId, name: n, keyHash: k.keyHash, keyPrefix: k.keyPrefix, scopes: AGENT_QA_SCOPES, preset: "AGENT_QA", role: "QA", createdById: userId } });
    return { row, raw: k.rawKey };
  };
  const k1 = await mk("a"), k2 = await mk("b");
  rawKey = k1.raw; keyId = k1.row.id;
  const base = { projectId, projectKey: key, actorEmail: u.email, actorId: userId, role: "QA" as const };
  ctx = { ...base, apiKeyId: k1.row.id };
  ctx2 = { ...base, apiKeyId: k2.row.id };
  for (const t of ["Login", "Logout", "Profil"]) {
    const r = await saveTestCaseCore(projectId, key, { title: t, steps: "1) buka {{url}} 2) klik 3) cek", expectedResult: "ok", userId });
    await prisma.testCase.update({ where: { id: r.id! }, data: { agentReady: true, testData: { url: "/x" } } });
  }
});

afterAll(async () => {
  await prisma.bug.deleteMany({ where: { projectId } });
  await prisma.testRun.deleteMany({ where: { projectId } });
  await prisma.agentRun.deleteMany({ where: { projectId } });
  await prisma.testCase.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("agent QA service (F9)", () => {
  it("create_test_run takes only agent-ready cases; steps filled from testData", async () => {
    const r = await call("create_test_run", { name: "Agent run", environment: "Staging", buildVersion: "b1" });
    expect(r.items).toBe(3);
    runId = r.testRunId;
  });

  it("AC-AG-04 two agents racing never claim the same item", async () => {
    const [a, b, c, d] = await Promise.all([ctx, ctx2, ctx, ctx2].map((x) => call("claim_next_item", { testRunId: runId }, x)));
    const ids = [a, b, c, d].filter((x) => !x.isError).map((x) => x.itemId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(3); // 3 items, 4 claims: one gets "tidak ada item"
    const one = [a, b, c, d].find((x) => !x.isError);
    expect(one.steps).toContain("/x");
    expect(one.totalSteps).toBe(3);
  });

  it("AC-AG-04 heartbeat sets step; expired lease can be reclaimed", async () => {
    const run = await prisma.testRun.findFirstOrThrow({ where: { id: runId }, include: { items: true } });
    const item = run.items[0];
    await prisma.testRunItem.update({ where: { id: item.id }, data: { runningByUserId: userId, leaseExpiresAt: new Date(Date.now() + 60_000) } });
    expect((await call("heartbeat", { itemId: item.id, step: 2, totalSteps: 3 })).ok).toBe(true);
    expect((await prisma.testRunItem.findUniqueOrThrow({ where: { id: item.id } })).currentStep).toBe(2);
    expect((await call("claim_next_item", { itemId: item.id }, ctx2)).isError).toBe(true); // still leased
    await prisma.testRunItem.update({ where: { id: item.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
    expect((await call("claim_next_item", { itemId: item.id }, ctx2)).itemId).toBe(item.id); // >90s silent -> reclaimable
  });

  it("AC-AG-05 FAIL needs failedStep + evidence; result is attributed to the owner via agent", async () => {
    const s = await call("start_session", { agentName: "pi", toolName: "playwright", testRunId: runId });
    const item = await prisma.testRunItem.findFirstOrThrow({ where: { testRunId: runId }, orderBy: { testCase: { code: "asc" } } });
    const bad = await call("record_result", { itemId: item.id, result: "FAIL", actualResult: "500", failedStep: 3, sessionId: s.sessionId });
    expect(bad.isError).toBe(true);
    expect(bad.error).toMatch(/Bukti wajib/);
    expect((await call("record_result", { itemId: item.id, result: "FAIL", actualResult: "500", links: ["https://x.test/a.png"], sessionId: s.sessionId })).error).toMatch(/failedStep/);
    const ok = await call("record_result", { itemId: item.id, result: "FAIL", actualResult: "500 password=hunter2hunter2", failedStep: 3, links: ["https://x.test/a.png", "https://x.test/b.png"], toolName: "playwright", sessionId: s.sessionId });
    expect(ok.ok).toBe(true);
    const att = await prisma.testRunAttempt.findFirstOrThrow({ where: { itemId: item.id } });
    expect(att).toMatchObject({ executedById: userId, viaAgent: true, agentName: "pi", toolName: "playwright", agentSessionId: s.sessionId, evidenceUrl: "https://x.test/a.png" });
    expect(att.actualResult).not.toContain("hunter2");
    expect(att.notes).toContain("Langkah gagal: 3");
    const after = await prisma.testRunItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.leaseExpiresAt).toBeNull(); // result releases lease

    // AC-AG-06 dedupe + draft
    const bug = await prisma.bug.create({ data: { projectId, number: 900, key: `${key}-900`, title: "Login 500", description: "d", severity: "HIGH", status: "OPEN", reporterId: userId } });
    expect((await call("link_bug_to_item", { itemId: item.id, bugKey: bug.key, comment: "build b1, Staging, langkah 3, a.png" })).ok).toBe(true);
    expect(await prisma.bugComment.count({ where: { bugId: bug.id } })).toBe(1);
    const draft = await call("create_bug_draft", { title: "Profil rusak total", stepsToReproduce: "1) a", expectedResult: "ok", actualResult: "x", sessionId: s.sessionId, testRunItemId: item.id });
    expect(draft.bugStatus).toBe("DRAFT");
    expect(await prisma.testRunItemBug.count({ where: { itemId: item.id } })).toBe(2);

    // AC-AG-07 summary
    const other = await prisma.testRunItem.findFirstOrThrow({ where: { testRunId: runId, id: { not: item.id } } });
    await call("record_result", { itemId: other.id, result: "PASS", sessionId: s.sessionId });
    const fin = await call("finish_session", { sessionId: s.sessionId, summary: "selesai" });
    expect(fin.summary).toMatchObject({ total: 2, passed: 1, failed: 1, newBugs: 1, linkedBugs: 1 });
    expect((await prisma.agentRun.findUniqueOrThrow({ where: { id: s.sessionId } })).finishedAt).not.toBeNull();
    expect(await prisma.notification.count({ where: { userId, type: "agent_session", sessionId: s.sessionId } })).toBe(1);
    expect((await call("finish_session", { sessionId: s.sessionId })).isError).toBe(true);
  });

  it("session of another key is refused; BLOCKED needs reason; revoked key stops", async () => {
    const s = await call("start_session", { agentName: "pi" });
    expect((await call("claim_next_item", { sessionId: s.sessionId }, ctx2)).error).toMatch(/Sesi/);
    const item = await prisma.testRunItem.findFirstOrThrow({ where: { testRunId: runId } });
    expect((await call("record_result", { itemId: item.id, result: "BLOCKED" })).error).toMatch(/blockedReason/);
    expect((await verifyApiKey(rawKey)).valid).toBe(true);
    await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
    expect((await verifyApiKey(rawKey)).valid).toBe(false);
  });
});
