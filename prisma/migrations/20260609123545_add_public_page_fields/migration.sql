-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "introMessage" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "showAddress" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showCancellationPolicy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showGallery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showHours" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showPhone" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showPrices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showReviews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showServices" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReview" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "reviewText" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryImage_businessId_idx" ON "GalleryImage"("businessId");

-- CreateIndex
CREATE INDEX "ClientReview_businessId_isApproved_idx" ON "ClientReview"("businessId", "isApproved");

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
