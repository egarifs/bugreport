import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const bin = new URL("./bin/bugboard.mjs", import.meta.url).pathname;

test("CLI sends MCP tools/call with bearer key and surfaces tool errors", async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const rpc = JSON.parse(body);
      seen.push({ auth: req.headers.authorization, ...rpc.params });
      const bad = rpc.params.arguments.result === "BAD";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { isError: bad, content: [{ type: "text", text: JSON.stringify(bad ? { error: "nope" } : { ok: true }) }] } }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const env = { ...process.env, BUGBOARD_URL: `http://127.0.0.1:${server.address().port}`, BUGBOARD_KEY: "test-key" };
  try {
    const ok = await run("node", [bin, "heartbeat", "--item", "i1", "--step", "2"], { env });
    assert.deepEqual(JSON.parse(ok.stdout), { ok: true });
    assert.deepEqual(seen[0], { auth: "Bearer test-key", name: "heartbeat", arguments: { itemId: "i1", step: 2 } });
    await assert.rejects(run("node", [bin, "result", "--item", "i1", "--result", "BAD"], { env }), (e) => /nope/.test(e.stderr));
    await assert.rejects(run("node", [bin, "heartbeat"], { env }), (e) => /Missing --item/.test(e.stderr));
  } finally { server.close(); }
});
