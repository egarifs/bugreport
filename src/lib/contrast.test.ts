import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// WCAG AA guard for design tokens: text pairs >= 4.5:1, in BOTH themes. Edit src/lib/theme-tokens.cjs, this re-checks it.
const themes = createRequire(import.meta.url)("./theme-tokens.cjs") as Record<"light" | "dark", Record<string, string>>;

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground token, background token]
const pairs: [string, string][] = [
  ["slate-400", "slate-50"], ["slate-400", "surface"], ["slate-400", "slate-100"],
  ["slate-500", "slate-100"], ["slate-900", "slate-50"], ["slate-900", "surface"],
  ["text-base", "surface-raised"], ["text-base", "surface-base"],
  ["text-muted", "surface-raised"], ["text-muted", "surface-sunken"], ["text-muted", "surface-base"],
  ["badge-neutral-text", "badge-neutral-bg"],
  ["link", "surface"], ["link", "slate-50"],
  ["on-action", "action"], ["on-action", "action-hover"],
  ["on-ink", "ink"], ["on-ink", "ink-hover"],
  ...(["blocker", "high", "medium", "low"] as const).map((s): [string, string] => [`sev-${s}`, `sev-${s}-bg`]),
  ...(["ok", "warn", "bad"] as const).map((s): [string, string] => [s, `${s}-bg`]),
  ...(["ok", "warn", "bad"] as const).map((s): [string, string] => [s, "surface"]),
];

for (const name of ["light", "dark"] as const) {
  test(`PRD-06 token contrast meets WCAG AA (${name})`, () => {
    const t = themes[name];
    for (const [fg, bg] of pairs) {
      assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${name} ${fg} on ${bg}: ${ratio(t[fg], t[bg]).toFixed(2)} < 4.5`);
    }
  });
}
