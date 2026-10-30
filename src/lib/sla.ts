import { BugSeverity, BugStatus } from "@prisma/client";

/**
 * Standard Industry SLA Target in Hours (Resolution Time).
 * - BLOCKER: 2 Hours (Critical / System Down)
 * - HIGH: 8 Hours (Major functionality broken)
 * - MEDIUM: 24 Hours (Moderate impact / workaround available)
 * - LOW: 72 Hours (Cosmetic / Minor annoyance)
 */
export const SLA_TARGET_HOURS: Record<BugSeverity, number> = {
  BLOCKER: 2,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 72,
};

export type SlaStatus = "NOT_APPLICABLE" | "SAFE" | "WARNING" | "BREACHED";

export interface SlaInfo {
  targetHours: number;
  elapsedHours: number;
  remainingHours: number;
  status: SlaStatus;
  label: string;
  isBreached: boolean;
  isWarning: boolean;
  tooltip: string;
}

const TERMINAL_STATUSES: Set<BugStatus> = new Set([
  BugStatus.CLOSED,
  BugStatus.INVALID,
  BugStatus.DUPLICATE,
  BugStatus.CANNOT_REPRODUCE,
  BugStatus.WONT_FIX,
]);

/**
 * Calculates real-time SLA status based on severity, status, and createdAt.
 * Pure function: zero DB schema changes needed.
 * ponytail: Calendar working hours skipped, use pure clock hours for 24/7 QA triage.
 */
export function calculateBugSla(
  severity: BugSeverity,
  status: BugStatus,
  createdAt: Date | string,
  now = new Date()
): SlaInfo {
  const targetHours = SLA_TARGET_HOURS[severity] ?? 24;

  // Drafts haven't been reviewed/approved yet; Closed/Resolved bugs are terminal
  if (status === BugStatus.DRAFT || TERMINAL_STATUSES.has(status)) {
    return {
      targetHours,
      elapsedHours: 0,
      remainingHours: 0,
      status: "NOT_APPLICABLE",
      label: status === BugStatus.DRAFT ? "Draft" : "Selesai",
      isBreached: false,
      isWarning: false,
      tooltip: status === BugStatus.DRAFT ? "SLA aktif setelah bug diapprove" : "Bug telah selesai / ditutup",
    };
  }

  const createdTime = new Date(createdAt).getTime();
  const diffMs = Math.max(0, now.getTime() - createdTime);
  const elapsedHours = diffMs / (1000 * 60 * 60);
  const remainingHours = targetHours - elapsedHours;

  const formatHours = (h: number): string => {
    if (h < 1) {
      const mins = Math.max(1, Math.round(h * 60));
      return `${mins}m`;
    }
    return `${h.toFixed(1)}j`;
  };

  if (remainingHours <= 0) {
    const overdueHours = Math.abs(remainingHours);
    return {
      targetHours,
      elapsedHours,
      remainingHours,
      status: "BREACHED",
      label: `+${formatHours(overdueHours)}`,
      isBreached: true,
      isWarning: false,
      tooltip: `SLA Breached! Target ${targetHours}j terlewat ${formatHours(overdueHours)} (Aktif: ${formatHours(elapsedHours)})`,
    };
  }

  // Warning when less than 25% SLA remaining
  const isWarning = remainingHours <= targetHours * 0.25;

  return {
    targetHours,
    elapsedHours,
    remainingHours,
    status: isWarning ? "WARNING" : "SAFE",
    label: formatHours(remainingHours),
    isBreached: false,
    isWarning,
    tooltip: `Target: ${targetHours}j | Sisa: ${formatHours(remainingHours)} (Aktif: ${formatHours(elapsedHours)})`,
  };
}
