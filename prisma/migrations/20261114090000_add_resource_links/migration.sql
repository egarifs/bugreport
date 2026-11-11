-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('TEST_ACCOUNTS');

-- CreateEnum
CREATE TYPE "ResourceAudience" AS ENUM ('PRIMARY', 'VENDOR');

-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('INTERNAL', 'INTERNAL_AND_VENDOR');

-- CreateEnum
CREATE TYPE "ResourceProblem" AS ENUM ('UNREACHABLE', 'ROLE_MISSING');

-- CreateTable
CREATE TABLE "ProjectResourceLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL DEFAULT 'TEST_ACCOUNTS',
    "audience" "ResourceAudience" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visibility" "ResourceVisibility" NOT NULL DEFAULT 'INTERNAL',
    "ownerUserId" TEXT,
    "lastOkAt" TIMESTAMP(3),
    "lastOkByUserId" TEXT,
    "lastProblem" "ResourceProblem",
    "lastProblemRole" TEXT,
    "lastProblemAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectResourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectResourceLink_projectId_kind_audience_key" ON "ProjectResourceLink"("projectId", "kind", "audience");

-- AddForeignKey
ALTER TABLE "ProjectResourceLink" ADD CONSTRAINT "ProjectResourceLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResourceLink" ADD CONSTRAINT "ProjectResourceLink_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

