-- Backfill Client.normalizedPhone from local Israeli format (0XXXXXXXXX)
-- to E.164 international format (+972XXXXXXXXX).
--
-- This is a safe, idempotent migration:
--   - Only rows matching ^0[0-9]{8,9}$ are updated (valid local format).
--   - Rows already in E.164 (+972...) are untouched.
--   - Rows with invalid/empty phones are left as-is and will be skipped
--     by the automation eligibility engine.

UPDATE "Client"
SET "normalizedPhone" = '+972' || SUBSTRING("normalizedPhone", 2)
WHERE "normalizedPhone" ~ '^0[0-9]{8,9}$';
