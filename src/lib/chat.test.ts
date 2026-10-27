import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { executeChatTool, ChatUserContext } from "./chat-tools";
import { askClaudeProjectChat } from "./claude-service";

test("PRD-04 Project AI Chat (Bugs + Business Docs)", async (t) => {
  // Setup project
  const project = await prisma.project.create({
    data: {
      key: `P4${Date.now().toString().slice(-4)}`,
      name: "Phase 4 AI Chat Project",
    },
  });

  const userVendor = await prisma.user.create({
    data: {
      email: `vendor_chat_${Date.now()}@example.com`,
      name: "Vendor Member",
      status: "ACTIVE",
    },
  });

  const userQa = await prisma.user.create({
    data: {
      email: `qa_chat_${Date.now()}@example.com`,
      name: "QA Member",
      status: "ACTIVE",
    },
  });

  // Create sample bugs
  const bug = await prisma.bug.create({
    data: {
      projectId: project.id,
      number: 1,
      key: `${project.key}-1`,
      title: "Gagal kalkulasi diskon paket",
      description: "Diskon tidak terpotong",
      stepsToReproduce: "1. Masukkan kupon",
      expectedResult: "Potongan 10%",
      actualResult: "Potongan 0%",
      severity: "BLOCKER",
      status: "OPEN",
      environment: "Staging",
      reporterId: userQa.id,
      comments: {
        createMany: {
          data: [
            { authorId: userQa.id, body: "Komentar publik untuk semua", type: "PUBLIC" },
            { authorId: userQa.id, body: "Catatan internal rahasia QA", type: "INTERNAL" },
          ],
        },
      },
    },
  });

  // Create sample business document
  const doc = await prisma.businessDoc.create({
    data: {
      projectId: project.id,
      title: "PRD Modul Paket RS",
      slug: "prd-modul-paket-rs",
      description: "Spesifikasi kuota dan kalkulasi diskon",
      versions: {
        create: {
          versionNum: 1,
          fileName: "prd_paket.pdf",
          storedPath: "/dummy/path.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          isCurrent: true,
        },
      },
    },
  });

  await t.test("Vendor cannot read internal comments via get_bug tool", async () => {
    const vendorCtx: ChatUserContext = {
      userId: userVendor.id,
      projectId: project.id,
      role: "VENDOR",
      isAdmin: false,
    };

    const resStr = await executeChatTool("get_bug", { bugKey: bug.key }, vendorCtx);
    const parsed = JSON.parse(resStr);

    assert.equal(parsed.key, bug.key);
    assert.equal(parsed.comments.length, 1);
    assert.equal(parsed.comments[0].type, "PUBLIC");
    assert.ok(!resStr.includes("Catatan internal rahasia QA"));
  });

  await t.test("QA/Admin can read internal comments via get_bug tool", async () => {
    const qaCtx: ChatUserContext = {
      userId: userQa.id,
      projectId: project.id,
      role: "QA",
      isAdmin: false,
    };

    const resStr = await executeChatTool("get_bug", { bugKey: bug.key }, qaCtx);
    const parsed = JSON.parse(resStr);

    assert.equal(parsed.comments.length, 2);
    assert.ok(resStr.includes("Catatan internal rahasia QA"));
  });

  await t.test("bug_stats accurately returns counts and release readiness", async () => {
    const qaCtx: ChatUserContext = {
      userId: userQa.id,
      projectId: project.id,
      role: "QA",
      isAdmin: false,
    };

    const statsStr = await executeChatTool("bug_stats", {}, qaCtx);
    const stats = JSON.parse(statsStr);

    assert.equal(stats.total, 1);
    assert.equal(stats.open, 1);
    assert.equal(stats.activeBlockers, 1);
    assert.equal(stats.releaseReady, false); // Not ready because 1 open blocker exists
  });

  await t.test("search_business_docs finds uploaded PRD with version", async () => {
    const qaCtx: ChatUserContext = {
      userId: userQa.id,
      projectId: project.id,
      role: "QA",
      isAdmin: false,
    };

    const docStr = await executeChatTool("search_business_docs", { query: "Paket" }, qaCtx);
    const docs = JSON.parse(docStr);

    assert.equal(docs.foundDocs.length, 1);
    assert.equal(docs.foundDocs[0].title, doc.title);
    assert.equal(docs.foundDocs[0].currentVersion, "v1");
  });

  await t.test("askClaudeProjectChat simulator returns accurate fallback response", async () => {
    const qaCtx: ChatUserContext = {
      userId: userQa.id,
      projectId: project.id,
      role: "QA",
      isAdmin: false,
    };

    const res = await askClaudeProjectChat(
      [{ role: "user", content: "Apakah project ini siap release?" }],
      qaCtx
    );

    assert.ok(res.reply.includes("BELUM SIAP RILIS"));
    assert.ok(res.reply.includes("Active Blockers: 1"));
  });
});
