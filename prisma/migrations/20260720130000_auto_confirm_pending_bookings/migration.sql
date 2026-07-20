-- Booking approval step removed: a client who booked an available slot is now
-- confirmed immediately, so bookings are never created as `pending`. Convert any
-- existing pending bookings to `approved` so they no longer look "awaiting approval".
-- Terminal statuses (completed/cancelled/no_show/rescheduled) are left untouched.
UPDATE "Booking"
SET "status" = 'approved'
WHERE "status" = 'pending';
