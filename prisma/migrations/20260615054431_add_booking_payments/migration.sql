-- CreateEnum
CREATE TYPE "PaymentProviderKind" AS ENUM ('mock', 'payplus', 'grow_meshulam', 'tranzila', 'disabled');

-- CreateEnum
CREATE TYPE "PaymentRequirement" AS ENUM ('none', 'deposit', 'full_payment');

-- CreateEnum
CREATE TYPE "DepositKind" AS ENUM ('fixed_amount', 'percentage');

-- CreateEnum
CREATE TYPE "PaymentConnectionStatus" AS ENUM ('not_connected', 'active', 'error');

-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('pending', 'payment_link_created', 'paid', 'failed', 'cancelled', 'expired', 'refunded');

-- CreateTable
CREATE TABLE "BusinessPaymentSettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "PaymentProviderKind" NOT NULL DEFAULT 'mock',
    "requirement" "PaymentRequirement" NOT NULL DEFAULT 'none',
    "depositType" "DepositKind" NOT NULL DEFAULT 'fixed_amount',
    "depositAmountMinor" INTEGER,
    "depositPercentage" INTEGER,
    "allowPayAtBusiness" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" "PaymentProviderKind" NOT NULL DEFAULT 'mock',
    "status" "PaymentConnectionStatus" NOT NULL DEFAULT 'not_connected',
    "credentialsEncrypted" TEXT,
    "publicConfigJson" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT,
    "provider" "PaymentProviderKind" NOT NULL,
    "status" "BookingPaymentStatus" NOT NULL DEFAULT 'pending',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "paymentUrl" TEXT,
    "providerTransactionId" TEXT,
    "providerPayloadJson" JSONB,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPaymentSettings_businessId_key" ON "BusinessPaymentSettings"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderConnection_businessId_key" ON "PaymentProviderConnection"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPayment_bookingId_key" ON "BookingPayment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPayment_providerTransactionId_key" ON "BookingPayment"("providerTransactionId");

-- CreateIndex
CREATE INDEX "BookingPayment_businessId_status_idx" ON "BookingPayment"("businessId", "status");

-- CreateIndex
CREATE INDEX "BookingPayment_businessId_bookingId_idx" ON "BookingPayment"("businessId", "bookingId");

-- AddForeignKey
ALTER TABLE "BusinessPaymentSettings" ADD CONSTRAINT "BusinessPaymentSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderConnection" ADD CONSTRAINT "PaymentProviderConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
