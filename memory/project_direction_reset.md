---
name: project-direction-reset
description: Allura product direction reset in June 2026 — focus is now on bringing customers back automatically, not generic CRM
metadata:
  type: project
---

The product direction was reset in June 2026. The new core goal is:

**Help beauty businesses automatically bring customers back.**

## New product focus
- Customer retention automation
- Win-back messages (manual WhatsApp for now, auto later)
- Booking reminders
- Customer import at scale
- Public client-facing page (book, see services, reviews, gallery)
- Revenue/expense/profit tracking
- Business owner control of public page

## New nav structure (10 items in sidebar)
- לוח הבקרה /dashboard
- תורים /bookings
- לקוחות /clients
- שירותים /services
- שעות פעילות /availability
- עמוד לקוחות /public-page (under "העסק")
- החזרת לקוחות /bring-back ← **core new feature**
- אוטומציות /automations (placeholder, future)
- כספים /finance (placeholder, future)
- הגדרות /settings

## Removed from sidebar (routes still exist, just not in nav)
- הודעות /messages
- שימור לקוחות /retention
- מוניטין /reputation
- תובנות מחיר /pricing
- לקוחות בסיכון /at-risk
- קמפיינים להחזרה /win-back-campaigns
- תחזית הכנסות /revenue-forecast
- חלונות פנויים /empty-slots

## Completed steps
- Step 0 — Nav cleanup, deposit UI removal, dashboard updated
- Step 1 — החזרת לקוחות hub at /bring-back (combined retention + at-risk + win-back, owner-configurable threshold, WhatsApp copy)

## Remaining steps (not yet built)
- Step 2 — Customer import (CSV/XLSX, duplicate detection)
- Step 3 — Booking reminder configuration
- Step 4 — Finance page (Expense model needed in Prisma)
- Step 5 — Public page customization (logo, gallery, sections)

**Why:** Direction shift from "manual CRM management" to "the system brings clients back for you." The retention/at-risk/win-back features were consolidated into one hub because having three separate pages for the same concept (bring clients back) was confusing.

**How to apply:** Do not add new standalone CRM-management pages. New features should support one of: bringing clients back, booking flow, client import, finance tracking, or public page customization. The WhatsApp messaging is always manual for now — never claim auto-sending exists.
