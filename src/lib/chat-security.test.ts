import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { executeChatTool, ChatUserContext } from "./chat-tools";
import { docFilePath } from "./business-docs";

test("AI Chat Shared Threads & Security Audit", async (t) => {
  const pA = await prisma.project.create({ data: { key: `THRA${Date.now().toString().slice(-4)}`, name: "Project A" } });
  const pB = await prisma.project.create({ data: { key: `THRB${Date.now().toString().slice(-4)}`, name: "Project B" } });

  const userA = await prisma.user.create({ data: { email: `usera_${Date.now()}@test.local`, name: "User A", status: "ACTIVE" } });
  const userB = await prisma.user.create({ data: { email: `userb_${Date.now()}@test.local`, name: "User B", status: "ACTIVE" } });

  await t.test("THREAD-01: User A creates thread, User B in same project can see thread and questions", async () => {
    const thread = await prisma.chatThread.create({
      data: {
        projectId: pA.id,
        userId: userA.id,
        title: "Kalkulasi Diskon Spesifikasi",
      },
    });

    await prisma.chatMessage.create({
      data: {
        projectId: pA.id,
        threadId: thread.id,
        userId: userA.id,
        role: "USER",
        content: "Bagaimana aturan diskon kupon?",
      },
    });

    await prisma.chatMessage.create({
      data: {
        projectId: pA.id,
        threadId: thread.id,
        userId: userA.id,
        role: "ASSISTANT",
        content: "Aturan diskon adalah 10% maksimal.",
      },
    });

    const projectThreads = await prisma.chatThread.findMany({
      where: { projectId: pA.id },
      include: {
        user: true,
        messages: { include: { user: true } },
      },
    });

    assert.equal(projectThreads.length, 1);
    assert.equal(projectThreads[0].title, "Kalkulasi Diskon Spesifikasi");
    assert.equal(projectThreads[0].user.id, userA.id);
    assert.equal(projectThreads[0].messages.length, 2);
    assert.equal(projectThreads[0].messages[0].user.name, "User A");
  });

  await t.test("THREAD-02: Threads are strictly isolated by project (Project B sees zero threads from Project A)", async () => {
    const pBThreads = await prisma.chatThread.findMany({
      where: { projectId: pB.id },
    });
    assert.equal(pBThreads.length, 0);
  });

  await t.test("SEC-02: Cross-project bug leak prevention in tools", async () => {
    const bugB = await prisma.bug.create({
      data: {
        projectId: pB.id,
        number: 1,
        key: `${pB.key}-1`,
        title: "Bug Rahasia Project B",
        description: "Detail rahasia B",
        stepsToReproduce: "1. test",
        expectedResult: "ok",
        actualResult: "fail",
        severity: "BLOCKER",
        status: "OPEN",
        environment: "Prod",
        reporterId: userB.id,
      },
    });

    const ctxA: ChatUserContext = {
      userId: userA.id,
      projectId: pA.id,
      role: "QA",
      isAdmin: false,
    };

    const res = await executeChatTool("get_bug", { bugKey: bugB.key }, ctxA);
    const parsed = JSON.parse(res);
    assert.ok(parsed.error, "Cross-project bug fetch must return error");
    assert.ok(!res.includes("Bug Rahasia Project B"));
  });

  await t.test("SEC-04: Strict Path Traversal Prevention on docFilePath", () => {
    const safe = docFilePath("../../../etc", "passwd");
    assert.ok(safe.includes("uploads/etc/docs/passwd"));
    assert.ok(!safe.includes("../"));

    const safeFile = docFilePath("PRJ", "../../secret.txt");
    assert.ok(safeFile.endsWith("uploads/PRJ/docs/secret.txt"));
  });

  await t.test("SEC-05: Untrusted Document Context Wrapping for Prompt Injection Defense", async () => {
    const docWithPayload = await prisma.businessDoc.create({
      data: {
        projectId: pA.id,
        title: "Security Spec Document",
        slug: "security-spec-doc",
        description: "Contains prompt injection payload",
        versions: {
          create: {
            versionNum: 1,
            fileName: "spec.md",
            storedPath: "/dummy/spec.md",
            fileSize: 100,
            mimeType: "text/markdown",
            isCurrent: true,
          },
        },
      },
    });

    const ctxA: ChatUserContext = {
      userId: userA.id,
      projectId: pA.id,
      role: "QA",
      isAdmin: false,
    };

    const res = await executeChatTool("read_business_doc", { title: docWithPayload.title }, ctxA);
    const parsed = JSON.parse(res);
    if (parsed.content) {
      assert.ok(parsed.content.includes("<untrusted_document_context"));
      assert.ok(parsed.content.includes("</untrusted_document_context>"));
    } else {
      assert.ok(parsed.error);
    }
  });
});
