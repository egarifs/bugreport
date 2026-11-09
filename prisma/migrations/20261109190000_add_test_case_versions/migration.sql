-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('DRAFT', 'READY', 'DEPRECATED');

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN "status" "TestCaseStatus" NOT NULL DEFAULT 'READY';

-- CreateTable
CREATE TABLE "TestCaseVersion" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changelog" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseVersion_testCaseId_version_key" ON "TestCaseVersion"("testCaseId", "version");

-- CreateIndex
CREATE INDEX "TestCaseVersion_testCaseId_idx" ON "TestCaseVersion"("testCaseId");

-- CreateIndex
CREATE INDEX "TestCaseVersion_createdById_idx" ON "TestCaseVersion"("createdById");

-- CreateIndex
CREATE INDEX "TestCase_projectId_status_idx" ON "TestCase"("projectId", "status");

-- AddForeignKey
ALTER TABLE "TestCaseVersion" ADD CONSTRAINT "TestCaseVersion_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseVersion" ADD CONSTRAINT "TestCaseVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
