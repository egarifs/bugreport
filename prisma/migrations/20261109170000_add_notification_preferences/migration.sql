-- CreateEnum
CREATE TYPE "NotificationDeliveryMode" AS ENUM ('IMMEDIATE', 'DAILY', 'PER_SESSION', 'OFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "focusUntil" TIMESTAMP(3),
ADD COLUMN "notificationScope" TEXT NOT NULL DEFAULT 'INVOLVED_ONLY';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "sessionId" TEXT,
ADD COLUMN "heldUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "mode" "NotificationDeliveryMode" NOT NULL DEFAULT 'IMMEDIATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_sessionId_idx" ON "Notification"("sessionId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_projectId_type_key" ON "NotificationPreference"("userId", "projectId", "type");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
