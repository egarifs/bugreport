import type { BugSeverity, BugStatus } from "@prisma/client";
import { STATUS_LABEL } from "@/components/ui/bug-badges";

// "external" is the safe default: anything not explicitly internal is treated as going outside the team.
export type ShareAudience = "external" | "internal";

export function parseAudience(value: string | null | undefined, canSeeInternal: boolean): ShareAudience {
  return value === "internal" && canSeeInternal ? "internal" : "external";
}

// Clients do not know what "Draft" means in our workflow; say what it is instead.
export function statusLabelFor(status: BugStatus, audience: ShareAudience): string {
  if (audience === "external" && status === "DRAFT") return "Menunggu review";
  return STATUS_LABEL[status] ?? status;
}

export interface ReleaseSummary {
  projectName: string;
  releaseReady: boolean;
  blockerCount: number;
  highCount: number;
  activeTotal: number;
  version?: string;
}

export function summarizeRelease(
  projectName: string,
  r: { releaseReady: boolean; releaseBlockers: { severity: BugSeverity }[]; openBySeverity: Record<string, number> },
  version?: string
): ReleaseSummary {
  return {
    projectName,
    releaseReady: r.releaseReady,
    blockerCount: r.releaseBlockers.filter((b) => b.severity === "BLOCKER").length,
    highCount: r.releaseBlockers.filter((b) => b.severity === "HIGH").length,
    activeTotal: Object.values(r.openBySeverity).reduce((a, n) => a + n, 0),
    version: version || undefined,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Fixed format and timezone so the PDF and the WA message read the same on every server: "2 Nov 2026, 14.05 WIB".
export function formatWib(date: Date): string {
  const wib = new Date(date.getTime() + 7 * 3_600_000);
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mm = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${wib.getUTCDate()} ${MONTHS[wib.getUTCMonth()]} ${wib.getUTCFullYear()}, ${hh}.${mm} WIB`;
}

export function isoDateWib(date: Date): string {
  return new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export function releaseVerdictLine(s: ReleaseSummary): string {
  if (s.releaseReady) return "SIAP RILIS (tidak ada Blocker atau High aktif)";
  return `BELUM SIAP (${s.highCount} bug High, ${s.blockerCount} Blocker)`;
}

// WhatsApp renders *text* as bold. No other markup is used so the message also reads fine in email or Slack.
export function buildShareMessage(s: ReleaseSummary, opts: { generatedAt: Date; liveUrl?: string }): string {
  const lines = [
    `*Kesiapan rilis ${s.projectName}*`,
    `Status: ${releaseVerdictLine(s)}`,
    `Target: ${s.version ?? "semua versi"}`,
    `Per ${formatWib(opts.generatedAt)}`,
    "",
    "PDF terlampir.",
  ];
  if (opts.liveUrl) lines.push(`Versi live: ${opts.liveUrl}`);
  return lines.join("\n");
}

export function releasePdfFilename(projectKey: string, audience: ShareAudience, at: Date): string {
  return `${projectKey}-kesiapan-rilis-${isoDateWib(at)}-${audience === "internal" ? "internal" : "eksternal"}.pdf`;
}
