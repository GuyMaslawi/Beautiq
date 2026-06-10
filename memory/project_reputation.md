---
name: project-reputation
description: Reviews & Reputation feature — internal CRM page for sending thank-you and review request messages after completed bookings
metadata:
  type: project
---

/reputation page is fully implemented.

**What was built:**
- Route `/reputation` — internal CRM page "מוניטין וביקורות"
- Shows completed bookings from the last 14 days (`RECENT_COMPLETED_BOOKINGS_DAYS = 14`)
- Each card has: client name, phone, service, date, price, "הושלם" badge
- Two actions per card: הודעת תודה / בקשת ביקורת — copy-to-clipboard only, no auto-send
- Thank-you message varies by whether booking was today or earlier
- Booking detail page (`/bookings/[bookingId]`) shows `BookingReputationCard` only when `status === "completed"`
- Client profile page (`/clients/[clientId]`) shows `ClientReputationCard` when client has a recent completed booking (within 14 days)
- Guidance rule J fires when `recentCompletedBookingsCount > 0`, links to `/reputation`
- "מוניטין" added to sidebar nav

**Key files:**
- `src/app/(app)/reputation/page.tsx`
- `src/server/reputation/queries.ts` — `getReputationBookings`, `getReputationSummary`, `getClientLatestCompletedBooking`
- `src/components/reputation/reputation-booking-card.tsx` — main list card
- `src/components/reputation/reputation-message-preview.tsx` — shared copy panel
- `src/components/reputation/booking-reputation-card.tsx` — booking detail card
- `src/components/reputation/client-reputation-card.tsx` — client profile card
- `src/lib/reputation/constants.ts` — `RECENT_COMPLETED_BOOKINGS_DAYS`
- `src/lib/reputation/messages.ts` — `generateThankyouMessage`, `generateReviewRequestMessage`
- `src/lib/constants/he.ts` — `REPUTATION` section
- `src/lib/guidance/rules.ts` — rule J
- `src/server/guidance/queries.ts` — `recentCompletedBookingsCount`

**Why:** Helps business owners follow up with clients after treatment to strengthen relationships and get reviews — manual WhatsApp copy only, no automation.

**How to apply:** All queries are scoped by `businessId`. Never accept businessId from client. Route is protected via `requireCurrentBusiness()`.
