-- CreateEnum
CREATE TYPE "WhatsAppCampaignStatus" AS ENUM ('draft', 'queued', 'processing', 'completed', 'completed_with_errors', 'cancelled');

-- CreateEnum
CREATE TYPE "WhatsAppCampaignRecipientStatus" AS ENUM ('queued', 'processing', 'accepted', 'sent', 'delivered', 'read', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "whatsappOptInAt" TIMESTAMP(3),
ADD COLUMN     "whatsappOptInSource" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppCampaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL DEFAULT 'he',
    "templateCategory" TEXT NOT NULL DEFAULT 'MARKETING',
    "variablePayload" JSONB,
    "audienceSummary" TEXT,
    "status" "WhatsAppCampaignStatus" NOT NULL DEFAULT 'draft',
    "totalSelected" INTEGER NOT NULL DEFAULT 0,
    "totalEligible" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "status" "WhatsAppCampaignRecipientStatus" NOT NULL DEFAULT 'queued',
    "skipReason" TEXT,
    "automationMessageId" TEXT,
    "metaMessageId" TEXT,
    "errorCode" INTEGER,
    "errorSubcode" INTEGER,
    "errorMessage" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppCampaign_businessId_status_idx" ON "WhatsAppCampaign"("businessId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppCampaign_businessId_createdAt_idx" ON "WhatsAppCampaign"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCampaign_businessId_idempotencyKey_key" ON "WhatsAppCampaign"("businessId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WhatsAppCampaignRecipient_campaignId_status_idx" ON "WhatsAppCampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppCampaignRecipient_businessId_idx" ON "WhatsAppCampaignRecipient"("businessId");

-- CreateIndex
CREATE INDEX "WhatsAppCampaignRecipient_metaMessageId_idx" ON "WhatsAppCampaignRecipient"("metaMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCampaignRecipient_campaignId_clientId_key" ON "WhatsAppCampaignRecipient"("campaignId", "clientId");

-- AddForeignKey
ALTER TABLE "WhatsAppCampaign" ADD CONSTRAINT "WhatsAppCampaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCampaignRecipient" ADD CONSTRAINT "WhatsAppCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WhatsAppCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCampaignRecipient" ADD CONSTRAINT "WhatsAppCampaignRecipient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCampaignRecipient" ADD CONSTRAINT "WhatsAppCampaignRecipient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
