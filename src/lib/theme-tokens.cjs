// Single source of truth for colors. tailwind.config.js turns these into CSS variables per theme,
// contrast.test.ts checks every text/background pair in BOTH themes against WCAG AA.
// Light = "kertas hangat"; dark = warm charcoal. Slate keeps its role names, so in dark the scale flips:
// slate-50 is still "page background" and slate-900 is still "body text".
const light = {
  "slate-50": "#F6F4EF", "slate-100": "#ECE7DE", "slate-200": "#E2DDD3", "slate-300": "#C9C2B5",
  "slate-400": "#625C51", "slate-500": "#514B42", "slate-600": "#3E3930", "slate-700": "#2E2A23",
  "slate-800": "#24211B", "slate-900": "#1F1C17",
  surface: "#FFFDF9",
  ink: "#1F1C17", "ink-hover": "#2E2A23", "on-ink": "#FFFDF9",
  scrim: "#1F1C17",
  action: "#1E5AA8", "action-hover": "#174A8C", "action-soft": "#E7ECF4", "on-action": "#FFFFFF",
  link: "#1E5AA8",
  "sev-blocker": "#B42318", "sev-blocker-bg": "#FDECEA",
  "sev-high": "#B54708", "sev-high-bg": "#FEF0E6",
  "sev-medium": "#8A6100", "sev-medium-bg": "#FDF6DC",
  "sev-low": "#3D5A80", "sev-low-bg": "#EAF0F7",
  ok: "#14783D", "ok-bg": "#E9F3EA", "ok-border": "#BFDCC6", "ok-solid": "#14783D",
  warn: "#7A5600", "warn-bg": "#FDF6DC", "warn-border": "#EBD9A1", "warn-solid": "#8A5A00",
  bad: "#B42318", "bad-bg": "#FDECEA", "bad-border": "#F0C2BC", "bad-solid": "#B42318",
  info: "#1E5AA8", "info-bg": "#E7ECF4", "info-border": "#C3D3EA", "info-solid": "#1E5AA8",
  violet: "#5B3A99", "violet-bg": "#EFE9F7", "violet-border": "#D5C8EC", "violet-solid": "#5B3A99",
};

const dark = {
  "slate-50": "#1A1916", "slate-100": "#24221E", "slate-200": "#34312B", "slate-300": "#4A463E",
  "slate-400": "#A8A196", "slate-500": "#BDB6AA", "slate-600": "#CFC9BE", "slate-700": "#DDD8CF",
  "slate-800": "#E6E2DA", "slate-900": "#ECE8E0",
  surface: "#22201C",
  ink: "#ECE8E0", "ink-hover": "#DDD8CF", "on-ink": "#1A1916",
  scrim: "#000000",
  action: "#2F68B8", "action-hover": "#285A9F", "action-soft": "#22324A", "on-action": "#FFFFFF",
  link: "#8FB6EE",
  "sev-blocker": "#F28B82", "sev-blocker-bg": "#3A1F1C",
  "sev-high": "#F0954A", "sev-high-bg": "#3A2617",
  "sev-medium": "#E3B341", "sev-medium-bg": "#352B14",
  "sev-low": "#8FB0D9", "sev-low-bg": "#1F2A38",
  ok: "#6CC18A", "ok-bg": "#1C2E22", "ok-border": "#2E5A3C", "ok-solid": "#1E7A45",
  warn: "#E3B341", "warn-bg": "#352B14", "warn-border": "#5C4A1E", "warn-solid": "#8A5A00",
  bad: "#F28B82", "bad-bg": "#3A1F1C", "bad-border": "#6A2E28", "bad-solid": "#B8322A",
  info: "#8FB6EE", "info-bg": "#22324A", "info-border": "#33507A", "info-solid": "#2F68B8",
  violet: "#B79CEB", "violet-bg": "#2C2440", "violet-border": "#4A3D6E", "violet-solid": "#6E4BB5",
};

module.exports = { light, dark };
