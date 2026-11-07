import type { BugSeverity, BugStatus } from "@prisma/client";

export const SEVERITY_STYLE: Record<BugSeverity, { label: string; badge: string; strip: string }> = {
  BLOCKER: { label: "Blocker", badge: "bg-sev-blocker-bg text-sev-blocker", strip: "bg-sev-blocker" },
  HIGH: { label: "High", badge: "bg-sev-high-bg text-sev-high", strip: "bg-sev-high" },
  MEDIUM: { label: "Medium", badge: "bg-sev-medium-bg text-sev-medium", strip: "bg-sev-medium" },
  LOW: { label: "Low", badge: "bg-sev-low-bg text-sev-low", strip: "bg-sev-low" },
};

export const SEVERITY_RANK: Record<BugSeverity, number> = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

import { STATUS_DICTIONARY } from "@/lib/status-dictionary";

export const STATUS_LABEL = Object.fromEntries(
  Object.entries(STATUS_DICTIONARY).map(([k, v]) => [k, v.internal]),
) as Record<BugStatus, string>;

// Status stays neutral on purpose: severity is the only loud color in a bug list.
export function SeverityBadge({ severity }: { severity: BugSeverity }) {
  const s = SEVERITY_STYLE[severity];
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${s.badge}`}>{s.label}</span>;
}

export function StatusBadge({ status }: { status: BugStatus }) {
  const strong = status === "DRAFT" || status === "REOPENED" || status === "READY_FOR_VERIFICATION";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs border ${
        strong ? "border-slate-700 text-slate-900 font-bold" : "border-slate-200 text-slate-600"
      }`}
    >
      <span aria-hidden="true" className="mr-1">{STATUS_DICTIONARY[status].glyph}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Whole days since date, e.g. "0h", "12h" (h = hari).
export function ageDays(from: Date, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}
