-- AlterTable: fix/verify/due tracking (revamp step 6). All nullable, no data change.
ALTER TABLE "Bug" ADD COLUMN "fixedInVersion" TEXT,
ADD COLUMN "fixedInBuild" TEXT,
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedInBuild" TEXT;
