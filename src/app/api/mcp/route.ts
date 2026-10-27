import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/mcp-auth";
import { executeMcpTool, MCP_TOOLS_DEFINITIONS, McpContext } from "@/lib/mcp-tools";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json(
      { error: "Authorization header dengan Bearer API key diperlukan." },
      { status: 401 }
    );
  }

  const rawKey = match[1].trim();
  const authResult = await verifyApiKey(rawKey);
  if (!authResult.valid || !authResult.apiKey || !authResult.project) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status || 401 }
    );
  }

  const { apiKey, project } = authResult;

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  const { id = 1, method, params } = body;

  const ctx: McpContext = {
    projectId: project.id,
    projectKey: project.key,
    apiKeyId: apiKey.id,
    actorEmail: apiKey.createdBy.email,
    actorId: apiKey.createdById,
  };

  // 1. Initialize MCP Handshake
  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "bugreport-mcp-server",
          version: "1.0.0",
        },
      },
    });
  }

  // 2. List available tools
  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS_DEFINITIONS,
      },
    });
  }

  // 3. Call tool
  if (method === "tools/call") {
    const toolName = String(params?.name || "");
    const args = (params?.arguments as Record<string, unknown>) || {};

    // Check scope mapping
    let requiredScope = "bug:read";
    if (toolName === "create_bug_draft") requiredScope = "bug:create";
    if (toolName === "add_bug_comment") requiredScope = "bug:comment";
    if (toolName === "attach_bug_screenshot") requiredScope = "bug:attach";

    if (!apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes("*")) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32003,
          message: `Scope '${requiredScope}' tidak diizinkan untuk API key ini.`,
        },
      });
    }

    const toolResult = await executeMcpTool(toolName, args, ctx);

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: toolResult,
    });
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method '${method}' tidak ditemukan.`,
    },
  });
}
