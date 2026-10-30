import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { generateApiKey, hashApiKey, verifyApiKey } from "./mcp-auth";
import { executeMcpTool, MCP_TOOLS_DEFINITIONS, McpContext } from "./mcp-tools";

test("PRD-03 MCP Server & AI Agent Integration", async (t) => {
  // Setup project and user
  const project = await prisma.project.create({
    data: {
      key: `MCP${Date.now().toString().slice(-4)}`,
      name: "MCP Test Project",
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `mcp_tester_${Date.now()}@example.com`,
      name: "MCP QA Tester",
      status: "ACTIVE",
    },
  });

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: {
      projectId: project.id,
      name: "Claude Code Runner",
      keyHash,
      keyPrefix,
      scopes: ["bug:read", "bug:create", "bug:comment", "bug:attach", "testcase:create"],
      createdById: user.id,
    },
  });

  const ctx: McpContext = {
    projectId: project.id,
    projectKey: project.key,
    apiKeyId: apiKey.id,
    actorEmail: user.email,
    actorId: user.id,
    role: "QA",
  };

  await t.test("API Key validation and hashing", async () => {
    assert.equal(hashApiKey(rawKey), keyHash);
    const validCheck = await verifyApiKey(rawKey, "bug:read");
    assert.equal(validCheck.valid, true);

    const wrongKeyCheck = await verifyApiKey("br_live_invalidkey12345");
    assert.equal(wrongKeyCheck.valid, false);
    assert.equal(wrongKeyCheck.status, 401);
  });

  await t.test("MCP tools definitions include all required tools", () => {
    const toolNames = MCP_TOOLS_DEFINITIONS.map((t) => t.name);
    assert.ok(toolNames.includes("search_bugs"));
    assert.ok(toolNames.includes("get_bug"));
    assert.ok(toolNames.includes("create_bug_draft"));
    assert.ok(toolNames.includes("add_bug_comment"));
    assert.ok(toolNames.includes("attach_bug_screenshot"));
    assert.ok(toolNames.includes("create_test_cases"));
  });

  await t.test("create_bug_draft always creates status DRAFT and redacts secrets", async () => {
    const result = await executeMcpTool(
      "create_bug_draft",
      {
        title: "Test automated failure Bearer sensitive_secret_token_abc",
        stepsToReproduce: "1. Jalankan test suite\n2. Cek token api_key=topsecret123",
        expectedResult: "200 OK",
        actualResult: "500 Internal Error",
        environment: "Staging",
        agentName: "playwright-ci",
        runId: "run-9988",
      },
      ctx
    );

    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.status, "CREATED");
    assert.equal(data.bugStatus, "DRAFT");

    // Fetch bug and verify redaction
    const bug = await prisma.bug.findUnique({
      where: { key: data.bugKey },
    });
    assert.ok(bug);
    assert.equal(bug.status, "DRAFT");
    assert.ok(!bug.title.includes("sensitive_secret_token_abc"));
    assert.ok(bug.title.includes("[REDACTED]"));
    assert.ok(!bug.stepsToReproduce.includes("topsecret123"));
  });

  await t.test("create_bug_draft stops on high similarity duplicate unless force: true", async () => {
    // Attempt to create identical title without force
    const dupResult = await executeMcpTool(
      "create_bug_draft",
      {
        title: "Test automated failure Bearer sensitive_secret_token_abc",
        stepsToReproduce: "1. Jalankan test suite",
        expectedResult: "200 OK",
        actualResult: "500 Internal Error",
        environment: "Staging",
      },
      ctx
    );

    const dupData = JSON.parse(dupResult.content[0].text);
    assert.equal(dupData.status, "DUPLICATE_CANDIDATE_FOUND");
    assert.ok(dupData.similarBugs.length > 0);

    // Now with force: true
    const forceResult = await executeMcpTool(
      "create_bug_draft",
      {
        title: "Test automated failure Bearer sensitive_secret_token_abc",
        stepsToReproduce: "1. Jalankan test suite",
        expectedResult: "200 OK",
        actualResult: "500 Internal Error",
        environment: "Staging",
        force: true,
      },
      ctx
    );

    const forceData = JSON.parse(forceResult.content[0].text);
    assert.equal(forceData.status, "CREATED");
  });

  await t.test("create_test_cases creates and updates test cases via MCP", async () => {
    const res = await executeMcpTool(
      "create_test_cases",
      {
        testCases: [
          {
            code: "TC-TEST-MCP-001",
            title: "Verifikasi login dengan Google OAuth Bearer sensitive_secret_token_xyz",
            module: "Auth",
            priority: "HIGH",
            testType: "Functional",
            targetRole: "All",
            precondition: "User punya akun Google",
            steps: "1. Buka login\n2. Klik Sign in",
            expectedResult: "Redirect ke dashboard",
            referenceUrl: "https://www.figma.com/file/sample",
          },
          {
            // code auto-generated
            title: "Verifikasi logout",
            steps: "1. Klik logout",
            expectedResult: "Kembali ke login",
          },
        ],
      },
      ctx
    );

    assert.equal(res.isError, undefined);
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, "SUCCESS");
    assert.equal(data.count, 2);
    assert.equal(data.items[0].action, "CREATED");
    assert.equal(data.items[0].code, "TC-TEST-MCP-001");

    // Check redact & db persistence
    const tc1 = await prisma.testCase.findUnique({
      where: { projectId_code: { projectId: ctx.projectId, code: "TC-TEST-MCP-001" } },
    });
    assert.ok(tc1);
    assert.ok(!tc1.title.includes("sensitive_secret_token_xyz"));
    assert.ok(tc1.title.includes("[REDACTED]"));
    assert.equal(tc1.referenceUrl, "https://www.figma.com/file/sample");

    // Upsert check: update TC-TEST-MCP-001
    const resUpdate = await executeMcpTool(
      "create_test_cases",
      {
        testCases: [
          {
            code: "TC-TEST-MCP-001",
            title: "Verifikasi login Google OAuth updated",
            steps: "1. Buka login\n2. Klik tombol",
            expectedResult: "Masuk dashboard",
          },
        ],
      },
      ctx
    );
    const updateData = JSON.parse(resUpdate.content[0].text);
    assert.equal(updateData.items[0].action, "UPDATED");
  });

  await t.test("Expired API key returns 401", async () => {
    // create expired key
    const exp = generateApiKey();
    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        name: "Expired Key",
        keyHash: exp.keyHash,
        keyPrefix: exp.keyPrefix,
        expiresAt: new Date(Date.now() - 10_000), // 10 seconds ago
        createdById: user.id,
      },
    });

    const check = await verifyApiKey(exp.rawKey);
    assert.equal(check.valid, false);
    assert.equal(check.status, 401);
    assert.match(String(check.error), /kedaluwarsa/);
  });

  await t.test("Non-QA agent is rejected from create/upload tools, but can search/read", async () => {
    const devCtx: McpContext = {
      ...ctx,
      role: "DEVELOPER",
    };

    // Attempt create bug draft with DEVELOPER role
    const bugRes = await executeMcpTool("create_bug_draft", { title: "Test", stepsToReproduce: "steps", expectedResult: "ok", actualResult: "fail" }, devCtx);
    assert.equal(bugRes.isError, true);
    assert.match(bugRes.content[0].text, /hanya dapat dijalankan oleh agent dengan role QA/);

    // Attempt create test case with DEVELOPER role
    const tcRes = await executeMcpTool("create_test_cases", { testCases: [{ title: "T", steps: "s", expectedResult: "e" }] }, devCtx);
    assert.equal(tcRes.isError, true);
    assert.match(tcRes.content[0].text, /hanya dapat dijalankan oleh agent dengan role QA/);

    // Attempt upload business doc with DEVELOPER role
    const docRes = await executeMcpTool("upload_business_doc", { title: "D", slug: "d", contentMarkdown: "md" }, devCtx);
    assert.equal(docRes.isError, true);
    assert.match(docRes.content[0].text, /hanya dapat dijalankan oleh agent dengan role QA/);

    // Can search test cases
    const listTcRes = await executeMcpTool("search_test_cases", {}, devCtx);
    assert.equal(listTcRes.isError, undefined);
    const tcList = JSON.parse(listTcRes.content[0].text);
    assert.ok(Array.isArray(tcList));

    // Can get single test case
    const getTcRes = await executeMcpTool("get_test_case", { code: "TC-TEST-MCP-001" }, devCtx);
    assert.equal(getTcRes.isError, undefined);
    const tcDetail = JSON.parse(getTcRes.content[0].text);
    assert.equal(tcDetail.code, "TC-TEST-MCP-001");
  });

  await t.test("QA agent can upload and read business docs via MCP", async () => {
    // Upload doc
    const uploadRes = await executeMcpTool(
      "upload_business_doc",
      {
        title: "Spesifikasi Auth & Login",
        slug: "spec-auth",
        description: "PRD alur autentikasi",
        contentMarkdown: "# Alur Auth\n\n1. Masuk Google\n2. Verifikasi Bearer secret_doc_token_12345",
      },
      ctx
    );

    assert.equal(uploadRes.isError, undefined);
    const upData = JSON.parse(uploadRes.content[0].text);
    assert.equal(upData.status, "SUCCESS");
    assert.equal(upData.slug, "spec-auth");
    assert.equal(upData.version, 1);

    // List docs
    const listRes = await executeMcpTool("list_business_docs", {}, ctx);
    const docs = JSON.parse(listRes.content[0].text);
    const found = docs.find((d: { slug: string }) => d.slug === "spec-auth");
    assert.ok(found);
    assert.equal(found.currentVersion, 1);

    // Read doc
    const readRes = await executeMcpTool("read_business_doc", { slug: "spec-auth" }, ctx);
    assert.equal(readRes.isError, undefined);
    const readData = JSON.parse(readRes.content[0].text);
    assert.equal(readData.slug, "spec-auth");
    assert.ok(readData.content.includes("Alur Auth"));
    assert.ok(!readData.content.includes("secret_doc_token_12345"));
    assert.ok(readData.content.includes("[REDACTED]"));
  });
  await t.test("Revoked API key returns 401", async () => {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { revokedAt: new Date() },
    });

    const check = await verifyApiKey(rawKey);
    assert.equal(check.valid, false);
    assert.equal(check.status, 401);
  });
});
