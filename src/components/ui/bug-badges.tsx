import type { BugSeverity, BugStatus } from "@prisma/client";

export const SEVERITY_STYLE: Record<BugSeverity, { label: string; badge: string; strip: string; level: number }> = {
  BLOCKER: { label: "Blocker", badge: "bg-sev-blocker-bg text-sev-blocker", strip: "bg-sev-blocker", level: 4 },
  HIGH: { label: "High", badge: "bg-sev-high-bg text-sev-high", strip: "bg-sev-high", level: 3 },
  MEDIUM: { label: "Medium", badge: "bg-sev-medium-bg text-sev-medium", strip: "bg-sev-medium", level: 2 },
  LOW: { label: "Low", badge: "bg-sev-low-bg text-sev-low", strip: "bg-sev-low", level: 1 },
};

export const SEVERITY_RANK: Record<BugSeverity, number> = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const STATUS_LABEL: Record<BugStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  READY_FOR_VERIFICATION: "Perlu verifikasi",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  INVALID: "Invalid",
  DUPLICATE: "Duplikat",
  CANNOT_REPRODUCE: "Tidak bisa direproduksi",
  WONT_FIX: "Won't fix",
};

// Four bars, filled by level: still readable in grayscale or for color-blind readers,
// and quieter than a filled chip so severity does not fight with status for attention.
const BAR_HEIGHTS = [5, 8, 11, 14];

export function SeverityBadge({ severity }: { severity: BugSeverity }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 whitespace-nowrap">
      <span aria-hidden="true" className="inline-flex items-end gap-[2px] h-[14px]">
        {BAR_HEIGHTS.map((h, i) => (
          <span key={h} className={`w-[3px] rounded-[1px] ${i < s.level ? s.strip : "bg-slate-200"}`} style={{ height: h }} />
        ))}
      </span>
      {s.label}
    </span>
  );
}

type Glyph = "draft" | "ring" | "half" | "three-quarter" | "done" | "alert" | "rejected";

const STATUS_STYLE: Record<BugStatus, { glyph: Glyph; color: string }> = {
  DRAFT: { glyph: "draft", color: "text-slate-500" },
  OPEN: { glyph: "ring", color: "text-info" },
  IN_PROGRESS: { glyph: "half", color: "text-warn" },
  READY_FOR_VERIFICATION: { glyph: "three-quarter", color: "text-violet" },
  CLOSED: { glyph: "done", color: "text-ok" },
  REOPENED: { glyph: "alert", color: "text-bad" },
  INVALID: { glyph: "rejected", color: "text-slate-500" },
  DUPLICATE: { glyph: "rejected", color: "text-slate-500" },
  CANNOT_REPRODUCE: { glyph: "rejected", color: "text-slate-500" },
  WONT_FIX: { glyph: "rejected", color: "text-slate-500" },
};

// Fill grows with progress (empty, half, three quarters, full), so the shape carries meaning without color.
export function StatusGlyph({ status, className = "" }: { status: BugStatus; className?: string }) {
  const g = STATUS_STYLE[status].glyph;
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" className={`shrink-0 ${className}`}>
      {g === "done" ? (
        <>
          <circle cx="7" cy="7" r="6.25" fill="currentColor" />
          <path d="M4.2 7.2 6.2 9.2 9.8 5.2" stroke="rgb(var(--c-surface))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray={g === "draft" ? "2.5 2.5" : undefined} />
          {g === "half" && <path d="M7 3.5 A3.5 3.5 0 0 1 7 10.5 Z" fill="currentColor" />}
          {g === "three-quarter" && <path d="M7 7 L7 3.5 A3.5 3.5 0 1 1 3.5 7 Z" fill="currentColor" />}
          {g === "alert" && (
            <>
              <path d="M7 4.2 V7.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="7" cy="9.4" r="0.9" fill="currentColor" />
            </>
          )}
          {g === "rejected" && <path d="M3.5 10.5 L10.5 3.5" stroke="currentColor" strokeWidth="1.5" />}
        </>
      )}
    </svg>
  );
}

export function StatusBadge({ status }: { status: BugStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${s.color}`}>
      <StatusGlyph status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// Whole days since date, e.g. "0h", "12h" (h = hari).
export function ageDays(from: Date, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}
