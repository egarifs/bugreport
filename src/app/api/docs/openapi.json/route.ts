import { NextResponse } from "next/server";

export async function GET() {
  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "BugReport API & MCP Server",
      version: "1.0.0",
      description:
        "Dokumentasi API lengkap untuk integrasi AI Agent (MCP JSON-RPC) dan REST endpoints BugReport by egarifs.",
      contact: {
        name: "QA Engineering Team",
        email: "admin@local.test",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key (br_live_...)",
          description: "Gunakan API Key yang digenerate dari menu Project Settings > API Keys",
        },
      },
      schemas: {
        Bug: {
          type: "object",
          properties: {
            id: { type: "string" },
            key: { type: "string", example: "CRM-12" },
            number: { type: "integer", example: 12 },
            title: { type: "string" },
            description: { type: "string" },
            stepsToReproduce: { type: "string" },
            expectedResult: { type: "string" },
            actualResult: { type: "string" },
            severity: { type: "string", enum: ["BLOCKER", "HIGH", "MEDIUM", "LOW"] },
            priority: { type: "string", enum: ["URGENT", "HIGH", "NORMAL", "LOW"] },
            status: { type: "string", enum: ["DRAFT", "OPEN", "IN_PROGRESS", "READY_FOR_VERIFICATION", "CLOSED"] },
            environment: { type: "string" },
            buildNumber: { type: "string" },
            component: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        McpRpcRequest: {
          type: "object",
          required: ["jsonrpc", "method"],
          properties: {
            jsonrpc: { type: "string", example: "2.0" },
            id: { type: "integer", example: 1 },
            method: {
              type: "string",
              enum: ["initialize", "tools/list", "tools/call"],
              example: "tools/call",
            },
            params: {
              type: "object",
              example: {
                name: "search_bugs",
                arguments: { query: "login", limit: 5 },
              },
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    paths: {
      "/api/mcp": {
        post: {
          summary: "MCP Streamable HTTP Endpoint (JSON-RPC 2.0)",
          description: "Endpoint resmi untuk MCP Client (Claude Code, MCP Inspector, Playwright Agent).",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/McpRpcRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "JSON-RPC response sukses",
            },
            "401": {
              description: "API key tidak valid atau revoked",
            },
            "429": {
              description: "Rate limit terlampaui (maksimal 30 call per menit)",
            },
          },
        },
      },
      "/api/projects/{key}/duplicates": {
        get: {
          summary: "Cek bug duplikat realtime (Trigram similarity)",
          parameters: [
            { name: "key", in: "path", required: true, schema: { type: "string" } },
            { name: "title", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Daftar bug yang mirip" },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
