-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);
