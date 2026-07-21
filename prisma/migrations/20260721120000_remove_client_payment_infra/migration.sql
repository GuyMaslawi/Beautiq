-- DropForeignKey
ALTER TABLE "BookingPayment" DROP CONSTRAINT "BookingPayment_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "BookingPayment" DROP CONSTRAINT "BookingPayment_businessId_fkey";

-- DropForeignKey
ALTER TABLE "BookingPayment" DROP CONSTRAINT "BookingPayment_clientId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessPaymentSettings" DROP CONSTRAINT "BusinessPaymentSettings_businessId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_clientId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentProviderConnection" DROP CONSTRAINT "PaymentProviderConnection_businessId_fkey";

-- DropTable
DROP TABLE "BookingPayment";

-- DropTable
DROP TABLE "BusinessPaymentSettings";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "PaymentProviderConnection";

-- DropEnum
DROP TYPE "BookingPaymentStatus";

-- DropEnum
DROP TYPE "PaymentConnectionStatus";

-- DropEnum
DROP TYPE "PaymentProviderKind";

-- DropEnum
DROP TYPE "PaymentRequirement";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "PaymentType";

