-- CreateTable
CREATE TABLE "BugCoReporter" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceBugId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugCoReporter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugCoReporter_bugId_idx" ON "BugCoReporter"("bugId");

-- CreateIndex
CREATE INDEX "BugCoReporter_userId_idx" ON "BugCoReporter"("userId");

-- CreateIndex
CREATE INDEX "BugCoReporter_sourceBugId_idx" ON "BugCoReporter"("sourceBugId");

-- CreateIndex
CREATE UNIQUE INDEX "BugCoReporter_bugId_userId_sourceBugId_key" ON "BugCoReporter"("bugId", "userId", "sourceBugId");

-- AddForeignKey
ALTER TABLE "BugCoReporter" ADD CONSTRAINT "BugCoReporter_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugCoReporter" ADD CONSTRAINT "BugCoReporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugCoReporter" ADD CONSTRAINT "BugCoReporter_sourceBugId_fkey" FOREIGN KEY ("sourceBugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

