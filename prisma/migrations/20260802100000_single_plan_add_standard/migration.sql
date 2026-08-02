-- Allura moves to a SINGLE subscription plan (see [[project_single_plan]]).
--
-- `standard` is the only plan written from here on. `premium` / `platinum` stay
-- in the type because Postgres cannot drop an enum value that columns still
-- reference; the backfill migration that follows empties them of rows.
--
-- Kept in its own migration on purpose: a value added by ALTER TYPE cannot be
-- USED in the same transaction, so the UPDATEs must run in a later one.
ALTER TYPE "AccountPlan" ADD VALUE IF NOT EXISTS 'standard';
