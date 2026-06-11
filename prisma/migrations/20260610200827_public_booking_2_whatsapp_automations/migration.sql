-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AutomationType" ADD VALUE 'morning_reminder';
ALTER TYPE "AutomationType" ADD VALUE 'review_request';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "reviewRequestSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "facebookUrl" TEXT;
