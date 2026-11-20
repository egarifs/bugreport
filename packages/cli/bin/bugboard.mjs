#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

// CLI = thin MCP client. All business rules live on the server.
const args = process.argv.slice(2);
const key = process.env.BUGBOARD_KEY;
const base = process.env.BUGBOARD_URL?.replace(/\/$/, "");

const option = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const need = (name) => { const v = option(name); if (!v) throw new Error(`Missing ${name}`); return v; };
const num = (name) => { const v = option(name); if (v === undefined) return undefined; const n = Number(v); if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`); return n; };
const list = (name) => option(name)?.split(",").map((x) => x.trim()).filter(Boolean);
const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

async function call(name, params) {
  if (!base || !key) throw new Error("Set BUGBOARD_URL and BUGBOARD_KEY");
  const response = await fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: drop(params) } }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body}`);
  const rpc = JSON.parse(body);
  if (rpc.error) throw new Error(rpc.error.message ?? JSON.stringify(rpc.error));
  const text = rpc.result?.content?.[0]?.text ?? "";
  let value = text;
  try { value = JSON.parse(text); } catch { /* plain text answer */ }
  if (rpc.result?.isError) throw new Error(typeof value === "string" ? value : value.error ?? JSON.stringify(value));
  return value;
}

// "group action" -> handler. Add a command = add a line.
const commands = {
  "session start": () => call("start_session", { agentName: option("--agent") || "bugboard-cli", toolName: option("--tool") || "CLI", workdir: process.cwd(), testRunId: option("--run") }),
  "session finish": () => call("finish_session", { sessionId: need("--session"), summary: option("--summary"), failed: args.includes("--failed") || undefined }),
  "resources": () => call("list_test_resources", {}),
  "cases": () => call("list_agent_test_cases", { query: option("--query"), priority: option("--priority"), includeMissing: args.includes("--include-missing") || undefined }),
  "run create": () => call("create_test_run", { name: need("--name"), environment: option("--env"), buildVersion: option("--build"), testCaseCodes: list("--cases") }),
  "run get": () => call("get_test_run", { testRunId: need("--run") }),
  "claim": () => call("claim_next_item", { testRunId: option("--run"), itemId: option("--item"), sessionId: option("--session"), agentName: option("--agent") }),
  "heartbeat": () => call("heartbeat", { itemId: need("--item"), step: num("--step"), totalSteps: num("--total") }),
  "result": () => call("record_result", {
    itemId: need("--item"), result: need("--result"), sessionId: option("--session"), actualResult: option("--actual"), failedStep: num("--failed-step"),
    blockedReason: option("--reason"), notes: option("--notes"), links: list("--links"), evidenceIds: list("--evidence"),
  }),
  "evidence": async () => {
    const file = need("--file");
    return call("upload_evidence", { fileName: path.basename(file), dataBase64: (await readFile(file)).toString("base64"), sessionId: option("--session") });
  },
  "bug link": () => call("link_bug_to_item", { itemId: need("--item"), bugKey: need("--bug"), comment: option("--comment") }),
  "result import": async () => call("import_junit_results", { testRunId: need("--run"), sessionId: need("--session"), xml: await readFile(args[2], "utf8"), sourceUrl: option("--source-url") }),
};

const usage = `Usage: bugboard <command> [options] [--json]
Env: BUGBOARD_URL, BUGBOARD_KEY
Commands: ${Object.keys(commands).join(" | ")}`;

try {
  const name = [`${args[0]} ${args[1]}`, args[0]].find((n) => commands[n]);
  if (!name) { console.log(usage); process.exitCode = 1; }
  else {
    const value = await commands[name]();
    console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
