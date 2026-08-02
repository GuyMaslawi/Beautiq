-- Move every existing row onto the single plan. There is exactly one plan now,
-- so an account that had access keeps access — and gets the full feature set.
--
-- Prices are NOT rewritten: `priceMinor` on a live subscription is the amount an
-- owner actually authorized at Grow, and silently changing it here would make the
-- ledger disagree with what the standing order really charges.
UPDATE "User" SET "plan" = 'standard' WHERE "plan" IS NOT NULL;
UPDATE "AccountSubscription" SET "plan" = 'standard';
UPDATE "SubscriptionCharge" SET "plan" = 'standard';
