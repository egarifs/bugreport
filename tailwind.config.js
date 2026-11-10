/** @type {import('tailwindcss').Config} */
// Every color is a CSS variable (values in src/lib/theme-tokens.cjs), so the same class works in light and dark.
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
  // dark: variants follow the token rule: explicit data-theme wins, otherwise the OS setting.
  darkMode: [
    "variant",
    [
      '@media (prefers-color-scheme: dark) { &:not(:where([data-theme="light"], [data-theme="light"] *)) }',
      '&:where([data-theme="dark"], [data-theme="dark"] *)',
    ],
  ],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      // Floor: nothing below 13px in dense tables.
      fontSize: { xs: ["0.8125rem", "1.125rem"], sm: ["0.875rem", "1.25rem"] },
      colors: {
        slate: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, c(`slate-${n}`)])),
        surface: { DEFAULT: c("surface"), base: c("surface-base"), raised: c("surface-raised"), sunken: c("surface-sunken") },
        text: { base: c("text-base"), muted: c("text-muted") },
        border: { base: c("border-base"), muted: c("border-muted") },
        "badge-neutral": { bg: c("badge-neutral-bg"), text: c("badge-neutral-text") },
        ink: { DEFAULT: c("ink"), hover: c("ink-hover") },
        "on-ink": c("on-ink"),
        scrim: c("scrim"),
        action: { DEFAULT: c("action"), hover: c("action-hover"), soft: c("action-soft") },
        "on-action": c("on-action"),
        link: c("link"),
        sev: group("sev", ["blocker", "blocker-bg", "high", "high-bg", "medium", "medium-bg", "low", "low-bg"]),
        ok: group("ok", ["", "bg", "border"]),
        warn: group("warn", ["", "bg", "border"]),
        bad: group("bad", ["", "bg", "border"]),
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
