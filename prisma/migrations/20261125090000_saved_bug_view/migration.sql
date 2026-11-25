-- CreateEnum
CREATE TYPE "SavedViewVisibility" AS ENUM ('PRIVATE', 'PROJECT');

-- CreateTable
CREATE TABLE "SavedBugView" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "visibility" "SavedViewVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedBugView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedBugView_projectId_visibility_idx" ON "SavedBugView"("projectId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "SavedBugView_projectId_ownerId_name_key" ON "SavedBugView"("projectId", "ownerId", "name");

-- AddForeignKey
ALTER TABLE "SavedBugView" ADD CONSTRAINT "SavedBugView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedBugView" ADD CONSTRAINT "SavedBugView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
