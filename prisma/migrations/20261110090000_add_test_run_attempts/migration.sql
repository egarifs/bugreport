-- CreateEnum
CREATE TYPE "TestRunDecision" AS ENUM ('PASS', 'PASS_WITH_NOTES', 'FAIL');

-- AlterEnum
ALTER TYPE "TestRunItemStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "decision" "TestRunDecision",
ADD COLUMN     "decisionNote" TEXT;

-- AlterTable
ALTER TABLE "TestRunItem" ADD COLUMN     "needsRerun" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rerunBugId" TEXT,
ADD COLUMN     "rerunBuild" TEXT,
ADD COLUMN     "skipReason" TEXT,
ADD COLUMN     "testCaseVersionId" TEXT;

-- CreateTable
CREATE TABLE "TestRunAttempt" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "result" "TestRunItemStatus" NOT NULL,
    "actualResult" TEXT,
    "notes" TEXT,
    "build" TEXT,
    "environment" TEXT,
    "evidenceUrl" TEXT,
    "testCaseVersionId" TEXT,
    "executedById" TEXT,
    "viaAgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRunAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRunItemBug" (
    "itemId" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRunItemBug_pkey" PRIMARY KEY ("itemId","bugId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestRunAttempt_itemId_seq_key" ON "TestRunAttempt"("itemId", "seq");

-- CreateIndex
CREATE INDEX "TestRunItemBug_bugId_idx" ON "TestRunItemBug"("bugId");

-- CreateIndex
CREATE INDEX "TestRunItem_rerunBugId_idx" ON "TestRunItem"("rerunBugId");

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItem" ADD CONSTRAINT "TestRunItem_testCaseVersionId_fkey" FOREIGN KEY ("testCaseVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItem" ADD CONSTRAINT "TestRunItem_rerunBugId_fkey" FOREIGN KEY ("rerunBugId") REFERENCES "Bug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunAttempt" ADD CONSTRAINT "TestRunAttempt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TestRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunAttempt" ADD CONSTRAINT "TestRunAttempt_testCaseVersionId_fkey" FOREIGN KEY ("testCaseVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunAttempt" ADD CONSTRAINT "TestRunAttempt_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItemBug" ADD CONSTRAINT "TestRunItemBug_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TestRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItemBug" ADD CONSTRAINT "TestRunItemBug_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItemBug" ADD CONSTRAINT "TestRunItemBug_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestRunAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill (AC-RUN-03): nothing from the legacy single-result model may be lost.
-- 1) every item points at the latest version of its test case
UPDATE "TestRunItem" i SET "testCaseVersionId" = (
  SELECT v."id" FROM "TestCaseVersion" v WHERE v."testCaseId" = i."testCaseId" ORDER BY v."version" DESC LIMIT 1
);

-- 2) every item that already has a result becomes attempt #1
INSERT INTO "TestRunAttempt" ("id", "itemId", "seq", "result", "actualResult", "notes", "build", "environment", "testCaseVersionId", "executedById", "createdAt")
SELECT gen_random_uuid()::text, i."id", 1, i."status", i."actualResult", i."notes", r."buildVersion", r."environment", i."testCaseVersionId", i."executedById", COALESCE(i."executedAt", CURRENT_TIMESTAMP)
FROM "TestRunItem" i JOIN "TestRun" r ON r."id" = i."testRunId"
WHERE i."status" <> 'NOT_RUN';

-- 3) Bug.testRunItemId -> join table (column itself is dropped in a later migration)
INSERT INTO "TestRunItemBug" ("itemId", "bugId", "attemptId")
SELECT b."testRunItemId", b."id", (SELECT a."id" FROM "TestRunAttempt" a WHERE a."itemId" = b."testRunItemId" AND a."seq" = 1)
FROM "Bug" b WHERE b."testRunItemId" IS NOT NULL;
