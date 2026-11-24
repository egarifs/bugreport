-- CreateTable
CREATE TABLE "PerformanceNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceNote_projectId_userId_periodType_periodKey_key" ON "PerformanceNote"("projectId", "userId", "periodType", "periodKey");

-- AddForeignKey
ALTER TABLE "PerformanceNote" ADD CONSTRAINT "PerformanceNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

