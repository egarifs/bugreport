-- Add explicit lifecycle status for agent sessions.
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
ALTER TABLE "AgentRun" ADD COLUMN "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING';
UPDATE "AgentRun" SET "status" = 'COMPLETED' WHERE "finishedAt" IS NOT NULL;
