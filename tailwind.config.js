/** @type {import('tailwindcss').Config} */
// "Kertas hangat" tokens. Every color is a CSS variable (values in src/lib/theme-tokens.cjs), so the
// same class works in light and dark: bg-slate-50 is "page", text-slate-900 is "body text" in both.
/* eslint-disable @typescript-eslint/no-require-imports -- Tailwind 3 loads this file as CommonJS */
const plugin = require("tailwindcss/plugin");
const { light, dark } = require("./src/lib/theme-tokens.cjs");
/* eslint-enable @typescript-eslint/no-require-imports */

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
const cssVars = (set) => Object.fromEntries(Object.entries(set).map(([k, v]) => [`--c-${k}`, rgb(v)]));
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const group = (prefix, keys) => Object.fromEntries(keys.map((k) => [k === "" ? "DEFAULT" : k, c(k === "" ? prefix : `${prefix}-${k}`)]));

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  // dark: variants follow the same rule as the tokens: explicit data-theme wins, otherwise the OS setting.
  darkMode: [
    "variant",
    [
      '@media (prefers-color-scheme: dark) { &:not(:where([data-theme="light"], [data-theme="light"] *)) }',
      '&:where([data-theme="dark"], [data-theme="dark"] *)',
    ],
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ['"Atkinson Hyperlegible Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // Floor: nothing below 13px in dense tables.
      fontSize: { xs: ["0.8125rem", "1.125rem"], sm: ["0.875rem", "1.25rem"] },
      colors: {
        slate: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, c(`slate-${n}`)])),
        surface: c("surface"),
        ink: { DEFAULT: c("ink"), hover: c("ink-hover") },
        "on-ink": c("on-ink"),
        scrim: c("scrim"),
        action: { DEFAULT: c("action"), hover: c("action-hover"), soft: c("action-soft") },
        "on-action": c("on-action"),
        link: c("link"),
        sev: group("sev", ["blocker", "blocker-bg", "high", "high-bg", "medium", "medium-bg", "low", "low-bg"]),
        ok: group("ok", ["", "bg", "border", "solid"]),
        warn: group("warn", ["", "bg", "border", "solid"]),
        bad: group("bad", ["", "bg", "border", "solid"]),
        info: group("info", ["", "bg", "border", "solid"]),
        violet: group("violet", ["", "bg", "border", "solid"]),
      },
      transitionDuration: { fast: "120ms", base: "180ms", slow: "240ms" },
      transitionTimingFunction: { out: "cubic-bezier(.2,.8,.2,1)" },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": { ...cssVars(light), colorScheme: "light" },
        '[data-theme="dark"]': { ...cssVars(dark), colorScheme: "dark" },
        "@media (prefers-color-scheme: dark)": {
          ':root:not([data-theme="light"])': { ...cssVars(dark), colorScheme: "dark" },
        },
      });
    }),
  ],
};
