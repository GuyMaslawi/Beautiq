-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "marketAveragePrice" DECIMAL(10,2),
ADD COLUMN     "marketMaxPrice" DECIMAL(10,2),
ADD COLUMN     "marketMinPrice" DECIMAL(10,2);
