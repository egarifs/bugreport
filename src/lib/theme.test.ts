import test from "node:test";
import assert from "node:assert/strict";
import { THEME_INIT_SCRIPT, normalizeTheme } from "./theme";

// Runs the real <head> script against a fake document, so it can never drift from normalizeTheme.
function runInitScript(stored: string | null) {
  const attrs: Record<string, string> = {};
  const fake = {
    localStorage: { getItem: () => stored },
    document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
  };
  new Function("localStorage", "document", THEME_INIT_SCRIPT)(fake.localStorage, fake.document);
  return attrs["data-theme"] ?? "system";
}

test("theme preference migrates old brand themes and never flashes the wrong one", () => {
  for (const stored of [null, "light", "dark", "default", "claude", "chatgpt", "antigravity", "garbage"]) {
    assert.equal(runInitScript(stored), normalizeTheme(stored), `stored=${stored}`);
  }
  assert.equal(normalizeTheme("antigravity"), "dark");
  assert.equal(normalizeTheme("claude"), "system");
});
