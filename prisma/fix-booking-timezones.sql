-- ============================================================
-- ONE-TIME MIGRATION: Fix booking startTime / endTime
-- ============================================================
--
-- Background
-- ----------
-- Before the code fix (2026-06-11), the app parsed booking times with:
--   new Date("YYYY-MM-DDTHH:MM:SS")
-- On a UTC server (Vercel) this treats Israel wall-clock input as UTC,
-- so a booking entered for "16:15 Israel" was stored as "16:15 UTC"
-- instead of the correct "13:15 UTC" (UTC+3 summer) / "14:15 UTC" (UTC+2 winter).
--
-- This script re-interprets each stored UTC timestamp as an Asia/Jerusalem
-- wall-clock time and converts it to the correct UTC value.
--
-- IMPORTANT: Run this script EXACTLY ONCE, BEFORE deploying the fixed code.
-- If new bookings already exist with correct UTC times (created after the fix),
-- add a WHERE condition:
--   WHERE "createdAt" < '2026-06-11 XX:XX:00+00'  -- replace with your deploy time
--
-- After running, verify with:
--   SELECT id, "startTime", "endTime", "createdAt" FROM "Booking" ORDER BY "startTime" DESC LIMIT 10;
-- ============================================================

BEGIN;

UPDATE "Booking"
SET
  "startTime" = ("startTime"::timestamp without time zone AT TIME ZONE 'Asia/Jerusalem'),
  "endTime"   = ("endTime"::timestamp without time zone AT TIME ZONE 'Asia/Jerusalem');

-- Verify: the times should now be ~2-3 hours earlier in UTC
-- than the old values. E.g., old 16:15 UTC → new 13:15 UTC.
SELECT
  id,
  "startTime",
  "startTime" AT TIME ZONE 'Asia/Jerusalem' AS "startTime_israel",
  "createdAt"
FROM "Booking"
ORDER BY "startTime" DESC
LIMIT 20;

COMMIT;
