-- Track when the business owner was notified about a (public) booking
-- request, to make owner notification idempotent (no duplicate emails).
ALTER TABLE "Booking" ADD COLUMN "ownerNotifiedAt" TIMESTAMP(3);
