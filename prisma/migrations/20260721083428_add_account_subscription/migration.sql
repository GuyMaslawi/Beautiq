-- CreateEnum
CREATE TYPE "AccountSubscriptionStatus" AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "AccountSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "AccountPlan" NOT NULL,
    "status" "AccountSubscriptionStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'grow',
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "processId" TEXT,
    "processToken" TEXT,
    "checkoutNonce" TEXT,
    "providerTransactionId" TEXT,
    "cardTokenEncrypted" TEXT,
    "cardSuffix" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastChargeAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountSubscription_userId_key" ON "AccountSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountSubscription_providerTransactionId_key" ON "AccountSubscription"("providerTransactionId");

-- CreateIndex
CREATE INDEX "AccountSubscription_status_currentPeriodEnd_idx" ON "AccountSubscription"("status", "currentPeriodEnd");

-- AddForeignKey
ALTER TABLE "AccountSubscription" ADD CONSTRAINT "AccountSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
