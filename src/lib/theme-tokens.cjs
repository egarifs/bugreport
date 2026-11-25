// Single source of truth for colors. tailwind.config.js turns these into CSS variables per theme and
// contrast.test.ts checks every text/background pair in BOTH themes against WCAG AA.
// Slate keeps its role names, so in dark the scale flips: slate-50 is still "page background",
// slate-900 is still "body text". Light values follow the revamp design (warm cream); dark is unchanged.
const light = {
  "slate-50": "#F6F4EF", "slate-100": "#ECE7DE", "slate-200": "#E2DDD3", "slate-300": "#CFC8BB",
  "slate-400": "#5C564C", "slate-500": "#4E4A41", "slate-600": "#3E3930", "slate-700": "#2E2A23",
  "slate-800": "#24211B", "slate-900": "#1F1C17",
  surface: "#FFFDF9", "surface-base": "#F6F4EF", "surface-raised": "#FFFDF9", "surface-sunken": "#ECE7DE",
  "text-base": "#1F1C17", "text-muted": "#5C564C",
  "border-base": "#E2DDD3", "border-muted": "#ECE7DE",
  "badge-neutral-bg": "#ECE7DE", "badge-neutral-text": "#3E3930",
  ink: "#1F1C17", "ink-hover": "#2E2A23", "on-ink": "#FFFFFF", scrim: "#1F1C17",
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
