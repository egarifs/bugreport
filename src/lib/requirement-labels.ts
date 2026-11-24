import type { RequirementStatus } from "@prisma/client";
import type { Coverage } from "@/lib/requirement";

export const REQ_STATUS_LABEL: Record<RequirementStatus, string> = {
  APPROVED: "Disetujui", READY: "Siap dikembangkan", IN_SPRINT: "Di sprint", DEV_DONE: "Selesai dikembangkan", VERIFIED: "Terverifikasi",
};
export const COVERAGE_LABEL: Record<Coverage, string> = {
  VERIFIED: "✓ Terverifikasi", FAILED: "✕ Gagal", UNTESTED: "○ Belum diuji", NO_TC: "– Tanpa test case", RECHECK: "↻ Perlu dicek ulang",
};
