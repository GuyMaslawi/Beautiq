-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('basic', 'pro');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'discounted', 'suspended', 'cancelled', 'pending_payment');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('none', 'fixed', 'percentage');

-- CreateTable
CREATE TABLE "BusinessSubscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'basic',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
    "monthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 149,
    "discountType" "DiscountType" NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(10,2),
    "discountNote" TEXT,
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSubscription_businessId_key" ON "BusinessSubscription"("businessId");

-- CreateIndex
CREATE INDEX "BusinessSubscription_status_idx" ON "BusinessSubscription"("status");

-- CreateIndex
CREATE INDEX "BusinessSubscription_plan_idx" ON "BusinessSubscription"("plan");

-- AddForeignKey
ALTER TABLE "BusinessSubscription" ADD CONSTRAINT "BusinessSubscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
