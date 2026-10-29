import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// WCAG AA guard for design tokens: text pairs >= 4.5:1. Edit tailwind.config.js, this test re-checks it.
const { colors } = createRequire(import.meta.url)("../../tailwind.config.js").theme.extend;

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("PRD-06 token contrast meets WCAG AA", () => {
  const { slate, action, sev } = colors;
  const pairs: [string, string, string][] = [
    ["muted text (slate-400) on page", slate[400], slate[50]],
    ["muted text (slate-400) on card", slate[400], "#FFFFFF"],
    ["body text on page", slate[900], slate[50]],
    ["button text on action", "#FFFFFF", action.DEFAULT],
    ["button text on action hover", "#FFFFFF", action.hover],
    ...(["blocker", "high", "medium", "low"] as const).map(
      (s): [string, string, string] => [`severity ${s}`, sev[s], sev[`${s}-bg`]],
    ),
  ];
  for (const [name, fg, bg] of pairs) {
    assert.ok(ratio(fg, bg) >= 4.5, `${name}: ${ratio(fg, bg).toFixed(2)} < 4.5`);
  }
});
