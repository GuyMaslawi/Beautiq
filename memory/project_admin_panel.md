---
name: project-admin-panel
description: Internal admin panel at /admin for Allura platform owners to manage customer businesses
metadata:
  type: project
---

Internal admin panel built for Allura platform owners (not business owners).

Route: `/admin`, `/admin/businesses`, `/admin/businesses/[businessId]`

Protected by env-based allowlist: `ADMIN_EMAILS=guymuslave@gmail.com` in `.env`. Uses `src/server/admin/auth.ts` → `requirePlatformAdmin()`.

Schema addition (migration `20260609142842_add_business_subscription`):
- New model: `BusinessSubscription` (one-to-one with Business)
- New enums: `SubscriptionPlan` (basic/pro), `SubscriptionStatus` (trial/active/discounted/suspended/cancelled/pending_payment), `DiscountType` (none/fixed/percentage)
- Monthly price defaults: Basic ₪149, Pro ₪199

Files created:
- `src/server/admin/auth.ts` — admin check helper
- `src/server/admin/queries.ts` — cross-tenant queries (all businesses, stats, detail)
- `src/server/admin/actions.ts` — updateBusinessSubscription (upserts subscription)
- `src/app/admin/layout.tsx` — dark top-bar shell, no app sidebar
- `src/app/admin/page.tsx` — overview stats (total, trial, active, discounted, suspended, bookings, clients)
- `src/app/admin/businesses/page.tsx` — searchable/filterable businesses table
- `src/app/admin/businesses/_components/businesses-search.tsx` — client search+filter component
- `src/app/admin/businesses/[businessId]/page.tsx` — business detail + subscription summary
- `src/app/admin/businesses/[businessId]/_components/subscription-form.tsx` — edit plan/status/price/discount/trial/notes

Security: admin routes redirect non-admins to /dashboard. Admin notes never appear in normal app. No admin links in business owner sidebar.

**Why:** Internal tooling for Allura team to manage customers, track plans/trials, apply discounts.
**How to apply:** Keep BusinessSubscription changes additive. Never expose adminNotes or cross-tenant data in the (app) routes.
