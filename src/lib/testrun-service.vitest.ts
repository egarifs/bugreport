import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db";
import { saveTestCaseCore } from "./testcase-service";
import {
  closeRun, createBugDraftFromTestRunItem, flagRerunForBug, linkBugToItem, logAttempt, reopenRun, updateItemVersion,
} from "./testrun-service";

const key = `TRA${Date.now().toString(36).toUpperCase()}`.slice(0, 10);
let projectId: string, actor: { id: string; email: string }, runId: string, tcId: string, itemId: string, item2Id: string;

async function mkBug(n: number, status: "OPEN" | "READY_FOR_VERIFICATION" = "OPEN") {
  return prisma.bug.create({
    data: { projectId, number: n, key: `${key}-${n}`, title: `b${n}`, description: "d", severity: "HIGH", status, reporterId: actor.id, fixedInVersion: "1.8.0", fixedInBuild: "b214" },
  });
}

beforeAll(async () => {
  const u = await prisma.user.create({ data: { email: `tra_${Date.now()}@example.com`, name: "QA", isAdmin: true, status: "ACTIVE" } });
  actor = { id: u.id, email: u.email };
  const p = await prisma.project.create({ data: { key, name: "Attempts", isTest: true } });
  projectId = p.id;
  await prisma.projectMember.create({ data: { projectId, userId: u.id, role: "QA" } });
  const a = await saveTestCaseCore(projectId, key, { title: "Login", steps: "1) buka", expectedResult: "ok", userId: actor.id });
  const b = await saveTestCaseCore(projectId, key, { title: "Logout", steps: "1) buka", expectedResult: "ok", userId: actor.id });
  tcId = a.id!;
  const v1 = await prisma.testCaseVersion.findFirstOrThrow({ where: { testCaseId: tcId } });
  const v1b = await prisma.testCaseVersion.findFirstOrThrow({ where: { testCaseId: b.id! } });
  const run = await prisma.testRun.create({ data: { projectId, name: "Regresi", environment: "Staging", buildVersion: "1.7.0", createdById: actor.id } });
  runId = run.id;
  itemId = (await prisma.testRunItem.create({ data: { testRunId: runId, testCaseId: tcId, testCaseVersionId: v1.id } })).id;
  item2Id = (await prisma.testRunItem.create({ data: { testRunId: runId, testCaseId: b.id!, testCaseVersionId: v1b.id } })).id;
});

afterAll(async () => {
  await prisma.bug.deleteMany({ where: { projectId } });
  await prisma.testRun.deleteMany({ where: { projectId } });
  await prisma.testCase.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: actor.id } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "dev_" }, status: "ACTIVE", memberships: { none: {} } } }).catch(() => {});
});

describe("test run attempts (F8)", () => {
  it("AC-RUN-01 two attempts keep both; item status = latest", async () => {
    expect(await logAttempt(actor, projectId, itemId, { result: "FAIL", actualResult: "500", evidenceUrl: "https://x.test/a.png" })).toHaveProperty("ok");
    expect(await logAttempt(actor, projectId, itemId, { result: "PASS" })).toHaveProperty("ok");
    const it = await prisma.testRunItem.findUniqueOrThrow({ where: { id: itemId }, include: { attempts: { orderBy: { seq: "asc" } } } });
    expect(it.status).toBe("PASS");
    expect(it.attempts.map((a) => [a.seq, a.result])).toEqual([[1, "FAIL"], [2, "PASS"]]);
    expect(it.attempts[0].build).toBe("1.7.0");
    expect(it.attempts[0].environment).toBe("Staging");
  });

  it("FAIL needs actual result, valid evidence link; SKIPPED needs reason (AC-RUN-04)", async () => {
    expect(await logAttempt(actor, projectId, item2Id, { result: "FAIL", evidenceUrl: "https://x.test" })).toHaveProperty("error");
    expect(await logAttempt(actor, projectId, item2Id, { result: "FAIL", actualResult: "x" })).toHaveProperty("error");
    expect(await logAttempt(actor, projectId, item2Id, { result: "FAIL", actualResult: "x", evidenceUrl: "javascript:alert(1)" })).toHaveProperty("error");
    expect(await logAttempt(actor, projectId, item2Id, { result: "SKIPPED" })).toHaveProperty("error");
    expect(await prisma.testRunAttempt.count({ where: { itemId: item2Id } })).toBe(0);
  });

  it("AC-RUN-03 many bugs per item, one bug on many items; draft idempotent per attempt", async () => {
    await logAttempt(actor, projectId, item2Id, { result: "FAIL", actualResult: "x", evidenceUrl: "https://x.test/b" });
    const first = await createBugDraftFromTestRunItem({ testRunItemId: item2Id, actorId: actor.id, actorEmail: actor.email });
    const again = await createBugDraftFromTestRunItem({ testRunItemId: item2Id, actorId: actor.id, actorEmail: actor.email });
    expect([first.created, again.created, again.bug.id === first.bug.id]).toEqual([true, false, true]);
    const extra = await mkBug(90);
    expect(await linkBugToItem(projectId, item2Id, extra.key)).toHaveProperty("ok");
    expect(await linkBugToItem(projectId, itemId, extra.key)).toHaveProperty("ok");
    expect(await prisma.testRunItemBug.count({ where: { itemId: item2Id } })).toBe(2);
    expect(await prisma.testRunItemBug.count({ where: { bugId: extra.id } })).toBe(2);
    expect(await linkBugToItem(projectId, itemId, "NOPE-1")).toHaveProperty("error");
  });

  it("AC-RUN-02 bug ready for verification flags failed linked items and notifies", async () => {
    const bug = await mkBug(91, "READY_FOR_VERIFICATION");
    await linkBugToItem(projectId, item2Id, bug.key);
    const dev = await prisma.user.create({ data: { email: `dev_${Date.now()}@example.com`, status: "ACTIVE" } });
    expect(await flagRerunForBug(bug.id, { id: dev.id, email: dev.email })).toBe(1);
    const it = await prisma.testRunItem.findUniqueOrThrow({ where: { id: item2Id } });
    expect([it.needsRerun, it.rerunBuild, it.rerunBugId]).toEqual([true, "1.8.0 · b214", bug.id]);
    expect(await prisma.notification.count({ where: { projectId, type: "rerun" } })).toBeGreaterThan(0);
    // New attempt clears the flag.
    await logAttempt(actor, projectId, item2Id, { result: "PASS" });
    expect((await prisma.testRunItem.findUniqueOrThrow({ where: { id: item2Id } })).needsRerun).toBe(false);
  });

  it("AC-TC-02 update to new version; old attempts keep old version", async () => {
    await saveTestCaseCore(projectId, key, { id: tcId, title: "Login", steps: "1) buka 2) isi", expectedResult: "ok", changelog: "langkah 2", userId: actor.id });
    expect(await updateItemVersion(actor, projectId, itemId)).toMatchObject({ ok: "Diperbarui ke v2." });
    const it = await prisma.testRunItem.findUniqueOrThrow({ where: { id: itemId }, include: { attempts: { include: { testCaseVersion: true } } } });
    expect(it.status).toBe("NOT_RUN");
    expect(it.attempts.every((a) => a.testCaseVersion?.version === 1)).toBe(true);
    expect(await updateItemVersion(actor, projectId, itemId)).toHaveProperty("error");
  });

  it("AC-RUN-05 close needs resolution + decision; closed run rejects attempts; reopen audited", async () => {
    expect(await closeRun(actor, projectId, runId, { decision: "PASS" })).toHaveProperty("error"); // itemId NOT_RUN unresolved
    expect(await closeRun(actor, projectId, runId, { decision: "PASS", resolutions: { [itemId]: { result: "SKIPPED" } } })).toHaveProperty("error");
    const ok = await closeRun(actor, projectId, runId, { decision: "PASS_WITH_NOTES", note: "ok", resolutions: { [itemId]: { result: "SKIPPED", reason: "env down" } } });
    expect(ok).toHaveProperty("ok");
    expect((await prisma.testRunItem.findUniqueOrThrow({ where: { id: itemId } })).status).toBe("SKIPPED");
    expect(await logAttempt(actor, projectId, itemId, { result: "PASS" })).toHaveProperty("error");
    expect(await reopenRun(actor, projectId, runId)).toHaveProperty("ok");
    expect(await prisma.auditLog.count({ where: { projectId, action: { in: ["test_run.close", "test_run.reopen"] } } })).toBe(2);
    expect(await logAttempt(actor, projectId, itemId, { result: "PASS" })).toHaveProperty("ok");
  });
});
