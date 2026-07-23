-- CreateEnum
CREATE TYPE "LoyaltyMessageType" AS ENUM ('almost_there', 'reward_earned');

-- AlterTable
ALTER TABLE "LoyaltyProgram" ADD COLUMN     "almostThereMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "autoSendEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rewardMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "templateLanguage" TEXT DEFAULT 'he',
ADD COLUMN     "templateName" TEXT;

-- CreateTable
CREATE TABLE "LoyaltyMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "LoyaltyMessageType" NOT NULL,
    "milestone" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyMessage_businessId_idx" ON "LoyaltyMessage"("businessId");

-- CreateIndex
CREATE INDEX "LoyaltyMessage_businessId_clientId_idx" ON "LoyaltyMessage"("businessId", "clientId");

-- CreateIndex
CREATE INDEX "LoyaltyMessage_businessId_createdAt_idx" ON "LoyaltyMessage"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyMessage_businessId_clientId_type_milestone_key" ON "LoyaltyMessage"("businessId", "clientId", "type", "milestone");

-- AddForeignKey
ALTER TABLE "LoyaltyMessage" ADD CONSTRAINT "LoyaltyMessage_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyMessage" ADD CONSTRAINT "LoyaltyMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyMessage" ADD CONSTRAINT "LoyaltyMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
