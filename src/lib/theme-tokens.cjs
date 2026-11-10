// Single source of truth for colors. tailwind.config.js turns these into CSS variables per theme and
// contrast.test.ts checks every text/background pair in BOTH themes against WCAG AA.
// Slate keeps its role names, so in dark the scale flips: slate-50 is still "page background",
// slate-900 is still "body text". Light values equal the pre-theme palette (no visual change).
const light = {
  "slate-50": "#F4F6F7", "slate-100": "#E9EDF0", "slate-200": "#D3DAE0", "slate-300": "#B8C2CB",
  "slate-400": "#5F6B76", "slate-500": "#4E5A65", "slate-600": "#3B4752", "slate-700": "#2A3641",
  "slate-800": "#1E2A35", "slate-900": "#15212B",
  surface: "#FFFFFF", "surface-base": "#F4F6F7", "surface-raised": "#FFFFFF", "surface-sunken": "#E9EDF0",
  "text-base": "#15212B", "text-muted": "#4E5A65",
  "border-base": "#D3DAE0", "border-muted": "#E9EDF0",
  "badge-neutral-bg": "#E9EDF0", "badge-neutral-text": "#3B4752",
  ink: "#15212B", "ink-hover": "#2A3641", "on-ink": "#FFFFFF", scrim: "#15212B",
  action: "#1E5AA8", "action-hover": "#174A8C", "action-soft": "#E8EFF8", "on-action": "#FFFFFF",
  link: "#1E5AA8",
  "sev-blocker": "#B42318", "sev-blocker-bg": "#FDECEA",
  "sev-high": "#B54708", "sev-high-bg": "#FEF0E6",
  "sev-medium": "#8A6100", "sev-medium-bg": "#FDF6DC",
  "sev-low": "#3D5A80", "sev-low-bg": "#EAF0F7",
  ok: "#14783D", "ok-bg": "#E9F3EA", "ok-border": "#BFDCC6",
  warn: "#7A5600", "warn-bg": "#FDF6DC", "warn-border": "#EBD9A1",
  bad: "#B42318", "bad-bg": "#FDECEA", "bad-border": "#F0C2BC",
};

const dark = {
  "slate-50": "#11181F", "slate-100": "#1A232C", "slate-200": "#27323D", "slate-300": "#3B4854",
  "slate-400": "#9AA7B3", "slate-500": "#B1BCC6", "slate-600": "#C5CED6", "slate-700": "#D6DDE3",
  "slate-800": "#E4E9ED", "slate-900": "#EEF1F4",
  surface: "#18212A", "surface-base": "#11181F", "surface-raised": "#18212A", "surface-sunken": "#0C1218",
  "text-base": "#EEF1F4", "text-muted": "#B1BCC6",
  "border-base": "#27323D", "border-muted": "#1A232C",
  "badge-neutral-bg": "#27323D", "badge-neutral-text": "#D6DDE3",
  ink: "#EEF1F4", "ink-hover": "#D6DDE3", "on-ink": "#11181F", scrim: "#000000",
  action: "#2F68B8", "action-hover": "#285A9F", "action-soft": "#1F3550", "on-action": "#FFFFFF",
  link: "#8FB6EE",
  "sev-blocker": "#F28B82", "sev-blocker-bg": "#3A1F1C",
  "sev-high": "#F0954A", "sev-high-bg": "#3A2617",
  "sev-medium": "#E3B341", "sev-medium-bg": "#352B14",
  "sev-low": "#8FB0D9", "sev-low-bg": "#1F2A38",
  ok: "#6CC18A", "ok-bg": "#1C2E22", "ok-border": "#2E5A3C",
  warn: "#E3B341", "warn-bg": "#352B14", "warn-border": "#5C4A1E",
  bad: "#F28B82", "bad-bg": "#3A1F1C", "bad-border": "#6A2E28",
};

module.exports = { light, dark };
