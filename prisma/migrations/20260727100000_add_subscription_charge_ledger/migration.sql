-- CreateEnum
CREATE TYPE "SubscriptionChargeOutcome" AS ENUM ('paid', 'failed');

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "plan" "AccountPlan" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "outcome" "SubscriptionChargeOutcome" NOT NULL,
    "providerTransactionId" TEXT,
    "directDebitId" TEXT,
    "cardSuffix" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCharge_providerTransactionId_key" ON "SubscriptionCharge"("providerTransactionId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_occurredAt_idx" ON "SubscriptionCharge"("occurredAt");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_userId_occurredAt_idx" ON "SubscriptionCharge"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_outcome_occurredAt_idx" ON "SubscriptionCharge"("outcome", "occurredAt");

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AccountSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

