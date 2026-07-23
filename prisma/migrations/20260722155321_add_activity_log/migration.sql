-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('owner', 'admin', 'system', 'client');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('auth', 'booking', 'client', 'service', 'availability', 'settings', 'finance', 'automation', 'campaign', 'loyalty', 'subscription', 'admin', 'other');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "userId" TEXT,
    "actorType" "ActivityActorType" NOT NULL DEFAULT 'owner',
    "category" "ActivityCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_businessId_createdAt_idx" ON "ActivityLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_category_createdAt_idx" ON "ActivityLog"("category", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
