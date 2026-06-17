-- AlterTable
-- Existing-number / coexistence onboarding support.
-- connectionSource records the owner's chosen onboarding track (guidance only).
-- numberConfirmedAt gates real sends until the owner confirms the connected number.
-- Both default to NULL, so existing rows are unchanged. Existing connections have
-- connectionSource = NULL and are therefore NOT subject to the new confirmation gate.
ALTER TABLE "WhatsAppConnection" ADD COLUMN     "connectionSource" TEXT,
ADD COLUMN     "numberConfirmedAt" TIMESTAMP(3);
