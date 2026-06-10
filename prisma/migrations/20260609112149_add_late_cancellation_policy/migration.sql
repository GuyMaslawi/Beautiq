-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "lateCancellationFeeStatus" TEXT;

-- AlterTable
ALTER TABLE "CancellationPolicy" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateCancellationFeeAmount" DECIMAL(10,2),
ADD COLUMN     "lateCancellationFeePercentage" DECIMAL(5,2),
ADD COLUMN     "lateCancellationFeeType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "lateCancellationHours" INTEGER;
