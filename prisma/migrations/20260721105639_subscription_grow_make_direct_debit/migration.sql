/*
  Warnings:

  - You are about to drop the column `cardTokenEncrypted` on the `AccountSubscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AccountSubscription" DROP COLUMN "cardTokenEncrypted",
ADD COLUMN     "directDebitId" TEXT;

-- CreateIndex
CREATE INDEX "AccountSubscription_directDebitId_idx" ON "AccountSubscription"("directDebitId");
