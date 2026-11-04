import { calculateBugSla } from "@/lib/sla";
import { BugSeverity, BugStatus } from "@prisma/client";

interface SlaBadgeProps {
  severity: BugSeverity;
  status: BugStatus;
  createdAt: Date | string;
  compact?: boolean;
}

export function SlaBadge({ severity, status, createdAt, compact = false }: SlaBadgeProps) {
  const sla = calculateBugSla(severity, status, createdAt);

  if (sla.status === "NOT_APPLICABLE") {
    return (
      <span className="text-slate-400 text-xs font-mono" title={sla.tooltip}>
        -
      </span>
    );
  }

  if (sla.status === "BREACHED") {
    return (
      <span
        title={sla.tooltip}
        className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded border border-bad-border bg-bad-bg text-bad animate-pulse shadow-2xs ${
          compact ? "text-[11px] px-1.5" : ""
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-bad-solid shrink-0" aria-hidden />
        <span>SLA {sla.label}</span>
      </span>
    );
  }

  if (sla.status === "WARNING") {
    return (
      <span
        title={sla.tooltip}
        className={`inline-flex items-center gap-1 font-mono font-semibold text-xs px-2 py-0.5 rounded border border-warn-border bg-warn-bg text-warn ${
          compact ? "text-[11px] px-1.5" : ""
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-warn-solid shrink-0" aria-hidden />
        <span>Sisa {sla.label}</span>
      </span>
    );
  }

  return (
    <span
      title={sla.tooltip}
      className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded border border-ok-border bg-ok-bg text-ok ${
        compact ? "text-[11px] px-1.5" : ""
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-ok-solid shrink-0" aria-hidden />
      <span>{sla.label}</span>
    </span>
  );
}
