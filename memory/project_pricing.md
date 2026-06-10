---
name: project-pricing-insights
description: Pricing Insights feature — /pricing route, market range fields, insights logic, and guidance integration
metadata:
  type: project
---

Pricing Insights feature implemented (2026-06-06).

**Why:** Help business owners understand price-per-hour value, identify long/underpriced services, track deposit exposure, and optionally compare against a manual market range they define themselves.

**How to apply:** Reference this when touching services, pricing, or guidance rules.

## What was built

- Prisma migration: `marketMinPrice`, `marketAveragePrice`, `marketMaxPrice` (Decimal?, nullable) added to `Service`
- Route: `/pricing` (protected, authenticated, server component)
- Nav item: "תובנות מחיר" with `TrendingUp` icon, between /reputation and /settings
- Lib: `src/lib/pricing/constants.ts` (thresholds), `src/lib/pricing/insights.ts` (rule-based insight generation)
- Server: `src/server/pricing/queries.ts` + `src/server/pricing/actions.ts`
- Components: `src/components/pricing/pricing-service-card.tsx` + `src/components/pricing/market-range-form.tsx`
- Guidance rule K: fires when `pricingConcernCount > 0` (long service without deposit, or price below manual min)

## Key rules

- No external market data — all range comparisons are against values the business owner inputs manually
- Careful Hebrew wording: "לפי הטווח שהוגדר", "נראה נמוך יחסית", never "ממוצע השוק"
- Inactive services show in the page but insights only compare them against active peers if isActive
