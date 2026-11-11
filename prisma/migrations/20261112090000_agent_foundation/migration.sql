-- CreateEnum
CREATE TYPE "ApiKeyPreset" AS ENUM ('AGENT_QA', 'READ_ONLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "summary" JSONB,
ADD COLUMN     "testRunId" TEXT,
ADD COLUMN     "toolName" TEXT,
ADD COLUMN     "workdir" TEXT;

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "preset" "ApiKeyPreset" NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "agentReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testData" JSONB;

-- AlterTable
ALTER TABLE "TestRunAttempt" ADD COLUMN     "agentName" TEXT,
ADD COLUMN     "agentSessionId" TEXT,
ADD COLUMN     "toolName" TEXT;

-- AlterTable
ALTER TABLE "TestRunItem" ADD COLUMN     "currentStep" INTEGER,
ADD COLUMN     "heartbeatAt" TIMESTAMP(3),
ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "runningAgentName" TEXT,
ADD COLUMN     "runningByUserId" TEXT,
ADD COLUMN     "runningSince" TIMESTAMP(3),
ADD COLUMN     "totalSteps" INTEGER;

-- AddForeignKey
ALTER TABLE "TestRunItem" ADD CONSTRAINT "TestRunItem_runningByUserId_fkey" FOREIGN KEY ("runningByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunAttempt" ADD CONSTRAINT "TestRunAttempt_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

