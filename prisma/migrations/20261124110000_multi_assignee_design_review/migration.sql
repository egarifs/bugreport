-- AlterEnum
ALTER TYPE "BugStatus" ADD VALUE 'DESIGN_REVIEW';

-- CreateEnum
CREATE TYPE "AssigneeRole" AS ENUM ('DEV', 'QA', 'DESIGN', 'OTHER');

-- CreateTable
CREATE TABLE "BugAssignee" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleSlot" "AssigneeRole" NOT NULL DEFAULT 'DEV',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugAssignee_bugId_idx" ON "BugAssignee"("bugId");

-- CreateIndex
CREATE INDEX "BugAssignee_userId_idx" ON "BugAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BugAssignee_bugId_userId_roleSlot_key" ON "BugAssignee"("bugId", "userId", "roleSlot");

-- AddForeignKey
ALTER TABLE "BugAssignee" ADD CONSTRAINT "BugAssignee_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugAssignee" ADD CONSTRAINT "BugAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing bug assignees into BugAssignee table with DEV roleSlot
INSERT INTO "BugAssignee" ("id", "bugId", "userId", "roleSlot", "createdAt")
SELECT gen_random_uuid()::text, "id", "assigneeId", 'DEV'::"AssigneeRole", NOW()
FROM "Bug"
WHERE "assigneeId" IS NOT NULL
ON CONFLICT DO NOTHING;
