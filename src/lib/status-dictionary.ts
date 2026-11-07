import type { BugStatus } from "@prisma/client";

// Single source of truth for bug status labels (AC-DICT-01).
// internal = QA/dev UI, notifikasi, PDF, MCP. portal = klien.
export const STATUS_DICTIONARY: Record<BugStatus, { internal: string; portal: string; glyph: string }> = {
  DRAFT: { internal: "Draft", portal: "Diterima", glyph: "○" },
  OPEN: { internal: "Open", portal: "Dalam antrean", glyph: "●" },
  IN_PROGRESS: { internal: "In progress", portal: "Dikerjakan", glyph: "◐" },
  READY_FOR_VERIFICATION: { internal: "Perlu verifikasi", portal: "Siap dicek", glyph: "◑" },
  CLOSED: { internal: "Closed", portal: "Selesai", glyph: "✓" },
  REOPENED: { internal: "Reopened", portal: "Dibuka kembali", glyph: "↺" },
  INVALID: { internal: "Invalid", portal: "Bukan masalah", glyph: "×" },
  DUPLICATE: { internal: "Duplikat", portal: "Sudah dilaporkan", glyph: "≡" },
  CANNOT_REPRODUCE: { internal: "Tidak bisa direproduksi", portal: "Belum bisa ditiru", glyph: "?" },
  WONT_FIX: { internal: "Won't fix", portal: "Tidak diperbaiki", glyph: "⊘" },
};

export function statusLabel(status: BugStatus, audience: "internal" | "portal" = "internal") {
  return STATUS_DICTIONARY[status]?.[audience] ?? status;
}
