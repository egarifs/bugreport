-- CreateTable
CREATE TABLE "BugTag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BugToBugTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BugToBugTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "BugTag_projectId_name_key" ON "BugTag"("projectId", "name");

-- CreateIndex
CREATE INDEX "_BugToBugTag_B_index" ON "_BugToBugTag"("B");

-- AddForeignKey
ALTER TABLE "BugTag" ADD CONSTRAINT "BugTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BugToBugTag" ADD CONSTRAINT "_BugToBugTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BugToBugTag" ADD CONSTRAINT "_BugToBugTag_B_fkey" FOREIGN KEY ("B") REFERENCES "BugTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

