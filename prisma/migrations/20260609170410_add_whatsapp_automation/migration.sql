-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('dev_mock', 'meta_cloud', 'twilio', 'green_api');

-- CreateEnum
CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('not_connected', 'pending', 'active', 'error');

-- CreateEnum
CREATE TYPE "AutomationType" AS ENUM ('win_back');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('running', 'completed', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "AutomationMessageStatus" AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "AutomationOfferType" AS ENUM ('none', 'discount_10', 'upgrade', 'special_slot', 'custom');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3),
ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WhatsAppConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'dev_mock',
    "status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'not_connected',
    "phoneNumber" TEXT,
    "wabaId" TEXT,
    "accessTokenEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationSetting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "AutomationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "thresholdDays" INTEGER NOT NULL DEFAULT 45,
    "sendHour" INTEGER NOT NULL DEFAULT 10,
    "messageTemplate" TEXT,
    "offerType" "AutomationOfferType" NOT NULL DEFAULT 'none',
    "offerValue" TEXT,
    "cooldownDays" INTEGER NOT NULL DEFAULT 30,
    "requireOptIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "AutomationType" NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "AutomationType" NOT NULL,
    "phone" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "AutomationMessageStatus" NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_businessId_key" ON "WhatsAppConnection"("businessId");

-- CreateIndex
CREATE INDEX "AutomationSetting_businessId_idx" ON "AutomationSetting"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSetting_businessId_type_key" ON "AutomationSetting"("businessId", "type");

-- CreateIndex
CREATE INDEX "AutomationRun_businessId_type_idx" ON "AutomationRun"("businessId", "type");

-- CreateIndex
CREATE INDEX "AutomationRun_businessId_status_idx" ON "AutomationRun"("businessId", "status");

-- CreateIndex
CREATE INDEX "AutomationRun_businessId_startedAt_idx" ON "AutomationRun"("businessId", "startedAt");

-- CreateIndex
CREATE INDEX "AutomationMessage_businessId_type_idx" ON "AutomationMessage"("businessId", "type");

-- CreateIndex
CREATE INDEX "AutomationMessage_businessId_clientId_idx" ON "AutomationMessage"("businessId", "clientId");

-- CreateIndex
CREATE INDEX "AutomationMessage_runId_idx" ON "AutomationMessage"("runId");

-- CreateIndex
CREATE INDEX "AutomationMessage_status_idx" ON "AutomationMessage"("status");

-- AddForeignKey
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "WhatsAppConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
