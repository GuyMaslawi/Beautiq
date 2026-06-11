-- AlterTable
ALTER TABLE "AutomationMessage" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AutomationMessage" ADD COLUMN "lastRetryAt" TIMESTAMP(3);
