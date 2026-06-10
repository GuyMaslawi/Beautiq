---
name: project-whatsapp-automation-phase1-5
description: WhatsApp automation Phase 1.5 — safety, phone normalization, opt-in UX, dev mock clarity
metadata:
  type: project
---

Phase 1.5 of WhatsApp automation is live (2026-06-09).

**Why:** Make Phase 1 production-safe before adding a real provider.

**Changes made:**

1. **Phone normalization** — `src/lib/phone.ts` now outputs E.164 (+972XXXXXXXXX) instead of local format (0XXXXXXXXX). All inputs (0XXXXXXXXX, 050-XXX, +972XXX, 972XXX) normalize consistently.

2. **DB backfill migration** — `20260609200000_normalize_phone_e164` converts existing `Client.normalizedPhone` from local to E.164 format. Already applied.

3. **Eligibility engine** — `src/server/win-back-automation/eligibility.ts` now validates E.164 regex (+972 prefix), adds `getEligibilityBreakdown()` returning counts per skip reason (noCompletedBooking, hasFutureBooking, noOptIn, invalidPhone, inCooldown).

4. **Dev mock** — `src/lib/whatsapp/provider.ts` dev mock returns `{ isMockSkip: true }`. Actions record these as `status=skipped` with `failureReason="מצב פיתוח — הודעה לא נשלחה בפועל"` instead of `sent`. Constant `DEV_MOCK_SKIP_REASON` exported.

5. **Stats split** — `WinBackStats` now has `realSentThisMonth` (real provider only), `mockRunsThisMonth` (dev mock runs), `failedThisMonth`, `skippedThisMonth`. `sentThisMonth` kept as deprecated alias = realSentThisMonth.

6. **Opt-in UX** — Client profile page has `ClientOptInForm` component with `whatsappOptIn` + `marketingOptIn` checkboxes. Server action `updateClientOptInAction` in `src/server/clients/actions.ts`. `ClientDetail` type now includes both opt-in fields.

7. **Status panel** — `WinBackStatusPanel` now shows: (a) confirmation dialog before running, (b) collapsible breakdown panel, (c) zero-eligible explanation when no clients qualify, (d) mock runs warning chip, (e) "הרצת בדיקה" vs "הפעלת שליחה עכשיו" button label based on real-send mode.

8. **Admin page** — Updated to show `realSentThisMonth` + `mockRunsThisMonth` separately.

**How to apply:** Invalid phones from old data are silently skipped (logged in automation messages with failureReason). No data is lost.

[[project_win_back_automation]]
