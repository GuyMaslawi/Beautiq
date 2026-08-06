-- Grow's Make app cannot cancel a recurring payment (the vendor states it must be
-- done on the Grow site), so cancelling in Allura closes access while the standing
-- order keeps charging the customer's card. This records when a human confirmed the
-- standing order was actually stopped; NULL on a cancelled/expired subscription that
-- still has a directDebitId means someone is still being billed.
-- AlterTable
ALTER TABLE "AccountSubscription" ADD COLUMN     "directDebitStoppedAt" TIMESTAMP(3);
