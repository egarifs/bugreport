import type { StlcKind, StlcStatus } from "@prisma/client";

export const KIND_LABEL: Record<StlcKind, { group: string; short: string; placeholder: string }> = {
  TEST_PLAN: { group: "Rencana uji (Test Plan)", short: "Test Plan", placeholder: "Test Plan rilis 1.8.0" },
  TEST_SUMMARY: { group: "Laporan uji (Test Summary)", short: "Test Summary", placeholder: "Test Summary Sprint 14" },
  RELEASE_NOTES: { group: "Release notes", short: "Release notes", placeholder: "Rilis 1.8.0" },
};
export const STATUS_LABEL_STLC: Record<StlcKind, Record<StlcStatus, string>> = {
  TEST_PLAN: { DRAFT: "Draf", APPROVED: "Disetujui", FINAL: "Final" },
  TEST_SUMMARY: { DRAFT: "Otomatis · draf", APPROVED: "Draf", FINAL: "Final" },
  RELEASE_NOTES: { DRAFT: "Draf", APPROVED: "Draf", FINAL: "Final" },
};
