-- Remove the deposit / prepayment ("מקדמה") concept from the product.
--
-- Deposits are no longer part of Allura. Online payment support remains
-- (none / full online payment / pay at business), but there is no upfront
-- deposit anywhere. This migration drops all deposit-specific columns and
-- removes the deposit values from the shared enums.
--
-- Data cleanup runs first so the enum recreations below cannot fail on rows
-- that still reference a removed value.

-- ── Data cleanup for enum-value removals ────────────────────────────────────
UPDATE "BusinessPaymentSettings" SET "requirement" = 'none' WHERE "requirement" = 'deposit';
DELETE FROM "Payment" WHERE "type" = 'deposit';
DELETE FROM "Recommendation" WHERE "type" = 'missing_deposit';

-- ── Drop deposit-specific columns ───────────────────────────────────────────
ALTER TABLE "Service" DROP COLUMN "requiresDeposit", DROP COLUMN "depositAmount";
ALTER TABLE "Booking" DROP COLUMN "depositStatus", DROP COLUMN "depositAmountSnapshot";
ALTER TABLE "BusinessPaymentSettings"
  DROP COLUMN "depositType",
  DROP COLUMN "depositAmountMinor",
  DROP COLUMN "depositPercentage";
ALTER TABLE "CancellationPolicy" DROP COLUMN "requireDepositToBook";

-- ── Drop now-unused enums ───────────────────────────────────────────────────
DROP TYPE "DepositStatus";
DROP TYPE "DepositKind";

-- ── Remove the `deposit` value from PaymentType ─────────────────────────────
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
CREATE TYPE "PaymentType" AS ENUM ('full', 'balance', 'refund');
ALTER TABLE "Payment" ALTER COLUMN "type" TYPE "PaymentType" USING ("type"::text::"PaymentType");
DROP TYPE "PaymentType_old";

-- ── Remove the `deposit` value from PaymentRequirement ──────────────────────
ALTER TYPE "PaymentRequirement" RENAME TO "PaymentRequirement_old";
CREATE TYPE "PaymentRequirement" AS ENUM ('none', 'full_payment');
ALTER TABLE "BusinessPaymentSettings" ALTER COLUMN "requirement" DROP DEFAULT;
ALTER TABLE "BusinessPaymentSettings"
  ALTER COLUMN "requirement" TYPE "PaymentRequirement" USING ("requirement"::text::"PaymentRequirement");
ALTER TABLE "BusinessPaymentSettings" ALTER COLUMN "requirement" SET DEFAULT 'none';
DROP TYPE "PaymentRequirement_old";

-- ── Remove the `missing_deposit` value from RecommendationType ──────────────
ALTER TYPE "RecommendationType" RENAME TO "RecommendationType_old";
CREATE TYPE "RecommendationType" AS ENUM (
  'client_not_returned',
  'empty_slot',
  'repeat_cancellations',
  'no_show',
  'revenue_drop',
  'waitlist_opportunity'
);
ALTER TABLE "Recommendation"
  ALTER COLUMN "type" TYPE "RecommendationType" USING ("type"::text::"RecommendationType");
DROP TYPE "RecommendationType_old";
