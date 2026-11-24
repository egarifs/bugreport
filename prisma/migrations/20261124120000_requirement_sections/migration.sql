-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('APPROVED', 'READY', 'IN_SPRINT', 'DEV_DONE', 'VERIFIED');

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "RequirementSection" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "RequirementStatus" NOT NULL DEFAULT 'APPROVED',
    "acceptanceCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moduleId" TEXT,
    "sprintId" TEXT,
    "readyAt" TIMESTAMP(3),
    "devDoneAt" TIMESTAMP(3),
    "devDoneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequirementSection_docId_idx" ON "RequirementSection"("docId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementSection_docId_anchor_key" ON "RequirementSection"("docId", "anchor");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "RequirementSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSection" ADD CONSTRAINT "RequirementSection_docId_fkey" FOREIGN KEY ("docId") REFERENCES "BusinessDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSection" ADD CONSTRAINT "RequirementSection_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSection" ADD CONSTRAINT "RequirementSection_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

