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
