# WhatsApp Embedded Signup — production debugging (Vercel)

This is the production-only checklist for diagnosing why Meta's Embedded Signup
popup may keep routing to **"Add a new number"** instead of offering an existing
WhatsApp Business App / coexistence flow.

> We test Embedded Signup **only in production on Vercel**. Local testing is not
> the source of truth. No real WhatsApp messages are sent during this checklist —
> connecting a number does not send anything.

## What Allura sends to Meta

The launch payload is built by [`src/lib/whatsapp/embedded-signup-launch.ts`](../src/lib/whatsapp/embedded-signup-launch.ts)
and passed to `FB.login(callback, config)` in
[`src/components/whatsapp/whatsapp-connection-card.tsx`](../src/components/whatsapp/whatsapp-connection-card.tsx).

The payload is **track-specific**:

| Track (owner choice)        | `intent` value          | `extras.featureType`                  |
| --------------------------- | ----------------------- | ------------------------------------- |
| יש לי WhatsApp Business קיים | `existing_business_app` | `whatsapp_business_app_onboarding`    |
| יש לי WhatsApp רגיל/אישי     | `personal`              | `""` (standard new-number flow)       |
| אין לי מספר עסקי / מספר חדש  | `new_number`            | `""` (standard new-number flow)       |

Common fields for every track:

```jsonc
{
  "config_id": "<NEXT_PUBLIC_META_CONFIG_ID>",
  "response_type": "code",
  "override_default_response_type": true,
  "extras": {
    "setup": {},
    "featureType": "<see table above>",
    "sessionInfoVersion": "3"
  }
}
```

`config_id` and `appId` are public values (`NEXT_PUBLIC_*`) — there are no secrets
in this payload, which is why it is safe to log and show in the admin debug box.

## Step-by-step

**A. Verify Vercel env**
- In the Vercel project → Settings → Environment Variables, confirm:
  - `NEXT_PUBLIC_META_CONFIG_ID = 1579233260602857`
  - `NEXT_PUBLIC_META_APP_ID` is set
  - `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_CREDENTIALS_ENCRYPTION_KEY` are set (server-side, for completing the connection).

**B. Redeploy after any env change.** `NEXT_PUBLIC_*` values are inlined at build
time, so a new value only takes effect after a fresh production deploy.

**C. Open `/automations` as an admin user.**

**D. Confirm the admin debug box "דיבאג חיבור Meta" shows:**
- `התאמת Config: yes` (and the green "הפרודקשן משתמש ב־Config החדש" banner)
- `מצב Facebook SDK: loaded`
- `window.FB קיים: yes`
- `סביבת ריצה: production`

If `התאמת Config` is `no`, production is **not** using the expected Config ID — go
back to A/B.

**E. Select "יש לי WhatsApp Business קיים"** in the chooser and continue.

**F. Confirm the launch payload (in the debug box and the browser console under
`[WA Embedded Signup] FB.login launch payload (sanitized)`) includes:**
- `selectedConnectionTrack: existing_business_app`
- `featureType: whatsapp_business_app_onboarding`

For the new-number track the same payload must show `featureType: ""`.

**G. Open Meta** (the popup launches automatically on continue).

**H. Expected if coexistence is available** for this app/config/account/number:
Meta shows a flow for connecting an **existing WhatsApp Business App** number, not
only "Add a new number".

**I. If Meta still shows only "Use a display name only" / "Add a new number":**
- Use the debug box buttons "מה Meta הציגה בפועל?" to record the observed result.
- Conclusion: **the code is launching correctly** (correct config_id + the
  existing-business `featureType`), but **Meta coexistence is not available** for
  this app / config / account / number — or the Meta dashboard needs an
  enablement that is not exposed through the Embedded Signup parameters.

## Why we record the Meta UI manually

Meta does **not** report back which UI flow it rendered. The `FB.login` callback
and the session-info `postMessage` events only tell us about the result (a code,
a WABA id, a cancel, or an error) — not which screens the user saw. So whether
coexistence was offered must be verified by a human watching the popup, and is
recorded in the admin debug box for the record.

## Where to look in code

- Payload builders + expected Config ID: `src/lib/whatsapp/embedded-signup-launch.ts`
- Launch + debug box: `src/components/whatsapp/whatsapp-connection-card.tsx`
- Owner-facing tracks/copy: `src/lib/whatsapp/connection-tracks.ts`
- Coexistence background: `docs/whatsapp-existing-number-coexistence.md`
