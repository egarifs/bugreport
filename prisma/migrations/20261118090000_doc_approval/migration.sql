CREATE TYPE "DocVersionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
-- Versi yang sudah ada dianggap disetujui.
ALTER TABLE "BusinessDocVersion"
  ADD COLUMN "status" "DocVersionStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "changeNote" TEXT,
  ADD COLUMN "decidedById" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3),
  ADD COLUMN "rejectReason" TEXT;
