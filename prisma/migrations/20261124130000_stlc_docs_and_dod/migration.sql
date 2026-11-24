-- CreateEnum
CREATE TYPE "StlcKind" AS ENUM ('TEST_PLAN', 'TEST_SUMMARY', 'RELEASE_NOTES');

-- CreateEnum
CREATE TYPE "StlcStatus" AS ENUM ('DRAFT', 'APPROVED', 'FINAL');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "dodItems" TEXT[] DEFAULT ARRAY['BLOCKER', 'HIGH', 'TEST_RUNS', 'REQUIREMENTS', 'SUMMARY']::TEXT[];

-- CreateTable
CREATE TABLE "StlcDoc" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "StlcKind" NOT NULL,
    "title" TEXT NOT NULL,
    "releaseVersion" TEXT,
    "sprintId" TEXT,
    "status" "StlcStatus" NOT NULL DEFAULT 'DRAFT',
    "body" JSONB NOT NULL DEFAULT '{}',
    "snapshot" JSONB,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StlcDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintClosure" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "exceptionReason" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StlcDoc_projectId_kind_idx" ON "StlcDoc"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SprintClosure_sprintId_key" ON "SprintClosure"("sprintId");

-- AddForeignKey
ALTER TABLE "StlcDoc" ADD CONSTRAINT "StlcDoc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StlcDoc" ADD CONSTRAINT "StlcDoc_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintClosure" ADD CONSTRAINT "SprintClosure_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

