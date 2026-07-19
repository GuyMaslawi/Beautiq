-- Hard DB-level guard against double-booking.
--
-- Two customers submitting the same offered public slot at nearly the same
-- moment both pass the application-level overlap check (a plain COUNT is not
-- atomic with the subsequent INSERT) and both get an active booking. This
-- partial unique index makes the database reject the second active booking for
-- the same business + start time, closing the race.
--
-- Scope: only "active" bookings (pending / approved) hold a slot. Cancelled,
-- completed, no_show and rescheduled bookings must NOT block the slot, so they
-- are excluded from the index. Verified in code: no path mutates an existing
-- booking's startTime, and no path re-activates a non-active booking, so only
-- the two booking.create paths (public + owner) can hit this constraint — both
-- already catch the failure and surface a friendly "slot taken" message.
--
-- NOTE: This is a PARTIAL unique index, which Prisma's schema DSL cannot
-- express, so it is maintained manually in this migration (see the comment in
-- prisma/schema.prisma on model Booking).
CREATE UNIQUE INDEX "Booking_business_active_slot_key"
  ON "Booking" ("businessId", "startTime")
  WHERE "status" IN ('pending', 'approved');
