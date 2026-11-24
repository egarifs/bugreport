-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isSandbox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sandboxOwnerId" TEXT;

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guideRole" TEXT,
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dismissedTours" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_sandboxOwnerId_key" ON "Project"("sandboxOwnerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_sandboxOwnerId_fkey" FOREIGN KEY ("sandboxOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

