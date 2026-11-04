import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// WCAG AA guard for design tokens, in BOTH themes: text pairs >= 4.5:1.
// Edit src/lib/theme-tokens.cjs (used by tailwind.config.js); this test re-checks every pair.
const { light, dark } = createRequire(import.meta.url)("./theme-tokens.cjs") as Record<"light" | "dark", Record<string, string>>;

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function pairs(): [string, string][] {
  const p: [string, string][] = [];
  for (const fg of ["slate-900", "slate-700", "slate-600", "slate-500", "slate-400", "link"]) {
    for (const bg of ["slate-50", "slate-100", "surface"]) p.push([fg, bg]);
  }
  p.push(["on-action", "action"], ["on-action", "action-hover"], ["on-ink", "ink"], ["on-ink", "ink-hover"]);
  p.push(["link", "action-soft"], ["slate-900", "action-soft"]);
  for (const s of ["blocker", "high", "medium", "low"]) {
    p.push([`sev-${s}`, `sev-${s}-bg`], [`sev-${s}`, "surface"], [`sev-${s}`, "slate-50"]);
  }
  for (const s of ["ok", "warn", "bad", "info", "violet"]) {
    p.push([s, `${s}-bg`], [s, "surface"], [s, "slate-50"], ["#FFFFFF", `${s}-solid`]);
  }
  return p;
}

for (const [name, tokens] of [["terang", light], ["gelap", dark]] as const) {
  test(`PRD-06 token contrast meets WCAG AA (tema ${name})`, () => {
    assert.deepEqual(Object.keys(tokens).sort(), Object.keys(light).sort(), "both themes define the same tokens");
    for (const [fg, bg] of pairs()) {
      const f = fg.startsWith("#") ? fg : tokens[fg];
      const r = ratio(f, tokens[bg]);
      assert.ok(r >= 4.5, `${name}: ${fg} on ${bg} = ${r.toFixed(2)} < 4.5`);
    }
  });
}
