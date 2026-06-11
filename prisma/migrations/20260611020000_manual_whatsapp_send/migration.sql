-- Add manual type for manual WhatsApp sends triggered by owner or admin
ALTER TYPE "AutomationType" ADD VALUE 'manual';

-- Track origin of each message (cron, manual_owner, manual_admin, retry)
ALTER TABLE "AutomationMessage" ADD COLUMN "source" TEXT;
