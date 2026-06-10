-- AlterTable
ALTER TABLE "AutomationMessage" ADD COLUMN     "failedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WhatsAppConnection" ADD COLUMN     "lastDeliveryEventAt" TIMESTAMP(3),
ADD COLUMN     "lastReadEventAt" TIMESTAMP(3),
ADD COLUMN     "lastWebhookReceivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AutomationMessage_providerMessageId_idx" ON "AutomationMessage"("providerMessageId");
