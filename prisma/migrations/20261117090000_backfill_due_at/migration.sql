-- Isi tenggat bug aktif yang belum punya tenggat: waktu diterima + target SLA severity (src/lib/sla.ts)
UPDATE "Bug"
SET "dueAt" = COALESCE("reviewedAt", "createdAt") + (
  CASE "severity" WHEN 'BLOCKER' THEN 2 WHEN 'HIGH' THEN 8 WHEN 'MEDIUM' THEN 24 ELSE 72 END
) * INTERVAL '1 hour'
WHERE "dueAt" IS NULL
  AND "status" IN ('OPEN', 'IN_PROGRESS', 'READY_FOR_VERIFICATION', 'REOPENED');
