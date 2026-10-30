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
        className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-700 animate-pulse shadow-2xs ${
          compact ? "text-[11px] px-1.5" : ""
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" aria-hidden />
        <span>SLA {sla.label}</span>
      </span>
    );
  }

  if (sla.status === "WARNING") {
    return (
      <span
        title={sla.tooltip}
        className={`inline-flex items-center gap-1 font-mono font-semibold text-xs px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 ${
          compact ? "text-[11px] px-1.5" : ""
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden />
        <span>Sisa {sla.label}</span>
      </span>
    );
  }

  return (
    <span
      title={sla.tooltip}
      className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 ${
        compact ? "text-[11px] px-1.5" : ""
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
      <span>{sla.label}</span>
    </span>
  );
}
