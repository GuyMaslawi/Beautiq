-- AlterTable
ALTER TABLE "WhatsAppConnection" ADD COLUMN     "connectedAt" TIMESTAMP(3),
ADD COLUMN     "disconnectedAt" TIMESTAMP(3),
ADD COLUMN     "displayPhoneNumber" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "phoneNumberId" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "useEnvFallback" BOOLEAN NOT NULL DEFAULT false;
