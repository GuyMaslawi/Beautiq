# Meta App Review Package — Allura

This document is the submission package for Meta App Review for the Allura WhatsApp
integration. It explains the product, justifies each requested permission, points to
the public legal pages, and gives the reviewer a step-by-step video script and test
notes.

| Field | Value |
| --- | --- |
| App / Product | **Allura** |
| Domain | https://allura.info |
| Privacy Policy | https://allura.info/privacy |
| Terms of Service | https://allura.info/terms |
| Support / Data contact | support@allura.info |
| Business Verification | Approved |
| Requested permissions | `whatsapp_business_messaging`, `whatsapp_business_management` |
| Connection method | Meta Embedded Signup (per-business) |

---

## 1. App purpose

**Allura is a Hebrew, right-to-left (RTL) CRM and business-management system for beauty
and wellness businesses in Israel** (nail artists, lash/brow artists, hair stylists,
makeup artists, cosmetics and aesthetic clinics, massage therapists, and similar small
service businesses).

The product is used by the **business owner** to run the day-to-day operations of their
business. Inside the authenticated dashboard, owners manage:

- **Clients** — a contact book of their own customers.
- **Bookings** — appointments, approvals, cancellations, no-shows, reschedules.
- **Services & pricing**, **availability**, and **deposits**.
- **Reminders** — appointment reminders sent to the client before the appointment.
- **Customer retention** — win-back / "come back" messages, review requests, and
  follow-up messages tied to a booking.

WhatsApp is the primary channel beauty business owners in Israel use to talk to their
clients. Allura helps the owner send the right operational message at the right time
(an appointment reminder, a review request after a treatment, or an approved win-back
message to a client who has not returned), instead of typing each message by hand.

All messaging in Allura is **per-business**: each business connects its own WhatsApp
Business Account and sends only to its own clients, under its own configuration and the
client opt-in/opt-out rules described in section 7.

---

## 2. Why `whatsapp_business_messaging` is needed

This permission is required so that a **business owner** can send messages from their own
WhatsApp Business account to their own clients. Specifically:

- **Appointment reminders.** Owners send reminders before a scheduled appointment
  (e.g. a reminder the day before) so clients show up on time and no-shows are reduced.
- **Approved win-back / retention messages.** Owners send template-based "come back"
  and review-request messages to existing clients (for example, a client who has not
  booked in a while), using pre-approved message templates.
- **Manual, booking-related messages.** Owners may manually send a message to a client
  about a specific booking (confirmation, reschedule, or a follow-up after the
  treatment) from the booking/client screens.

All sends are driven by the **business owner's own configuration and consent / opt-in
rules**. A business only ever messages its own clients. Allura never messages on behalf
of one business to another business's clients, and it does not run cross-business or
marketing-list campaigns. Clients can opt out at any time (see section 7), and opted-out
clients are excluded from further sends.

---

## 3. Why `whatsapp_business_management` is needed

This permission is required to set up and maintain each business's WhatsApp connection
and its message templates:

- **Embedded Signup connection.** Allura connects the **business owner's own WhatsApp
  Business Account (WABA)** using **Meta Embedded Signup**. The owner authorizes the
  connection from inside Allura; Allura completes the signup, registers the phone number
  for the Cloud API, and subscribes the app to the WABA for delivery webhooks.
- **Template management / sync.** Allura needs to create and sync the WhatsApp **message
  templates** used for the operational flows above — appointment reminders, review
  requests, and customer-return ("win-back") messages — and to read their approval status
  so the owner can see which templates are ready to send.
- **Secure per-business connection storage.** Allura stores each business's WhatsApp
  connection (including its access token) **encrypted at rest** and scoped to that single
  business (see sections 5 and 7).

Without `whatsapp_business_management`, Allura cannot complete Embedded Signup for the
owner's WABA or manage the templates required for the messaging flows.

---

## 4. Privacy / Terms URLs

| Document | URL | Access |
| --- | --- | --- |
| Privacy Policy | https://allura.info/privacy | Public, no login required |
| Terms of Service | https://allura.info/terms | Public, no login required |
| Support / Data contact | support@allura.info | — |

Both pages are served from the public (unauthenticated) part of the app
(`src/app/privacy/page.tsx` and `src/app/terms/page.tsx`), so the Meta reviewer can open
them directly without signing in.

---

## 5. Video script (screen recording)

Record a short screen capture (roughly 2–3 minutes) that walks through the connection and
messaging flow. Narrate each step. Suggested script:

1. **Log in to Allura.** Open https://allura.info, sign in with the reviewer test account,
   and land on the business dashboard (Hebrew, RTL).
2. **Open Automations.** Navigate to the **אוטומציות / Automations** page (`/automations`).
   Point out the page where WhatsApp connection and automated messages are managed.
3. **Start the WhatsApp connection.** Click the **"חיבור WhatsApp Business"** button
   (the WhatsApp connection card).
4. **Complete / demonstrate Embedded Signup.** The Meta Embedded Signup popup opens. Show
   selecting the WhatsApp Business Account and phone number and completing the flow. (If a
   live connection cannot be completed during recording, demonstrate the popup opening and
   explain that this is the standard Meta Embedded Signup dialog.)
5. **Show the connection status.** Back in Allura, show the connection status badge change
   to **"מחובר"** (connected) with the connected phone number displayed.
6. **Show templates / status.** Show the per-automation template rows — appointment
   reminder, review request, and customer-return messages — with their readiness status
   (e.g. **"מוכן לשליחה"** = ready to send). Optionally click **"סנכרון תבניות"**
   (sync templates) to show template management.
7. **Show sending a message.** Trigger a test or manual WhatsApp message to a client (for
   example, an appointment reminder or a manual message from a booking). Explain that real
   sends are gated unless test credentials are configured (see section 6).
8. **Show the message log / status.** Show the message log where each send records its
   status (**sent / delivered / read / failed**) with timestamps, updated from Meta's
   delivery webhooks.
9. **Show opt-in / unsubscribe safety.** Show the client opt-in / unsubscribe handling:
   clients can reply **STOP** / **הסר** to opt out, and Allura stops messaging them. If
   visible in the UI, point out the opt-out state on a client record.

### Video script summary

Log in → open Automations → click **"חיבור WhatsApp Business"** → complete Meta Embedded
Signup → show connected status + phone number → show templates and their approval status →
send a test/manual message → show the per-message delivery log (sent/delivered/read) →
show STOP/הסר opt-out safety.

---

## 5a. Demo recording options (two videos)

Meta App Review needs proof for **two** permissions. Record **two short videos** so
each permission is demonstrated clearly and honestly. Allura ships a dedicated,
admin/reviewer-only **"סקירת Meta — מצב הדגמה"** (Meta review — demo mode) panel on the
**Automations** page that drives the test send and shows every real-send guard. The
panel is only visible to a reviewer/admin account; regular business owners never see it.

### Video A — `whatsapp_business_management` (Embedded Signup + template sync)

Proves the business can connect its own WABA and manage templates. A live connected
account is **not** required to demonstrate the flow.

1. Log in to Allura with the reviewer test account and open **אוטומציות / Automations**.
2. Click **"חיבור WhatsApp Business"** to launch the Meta **Embedded Signup** popup.
   Show selecting the WhatsApp Business Account and phone number.
3. After the callback completes, show the connection card change to **"מחובר"** with the
   connected display phone number and connection health.
4. Show the per-automation **template rows** with their statuses (e.g. **"מוכן לשליחה"** /
   **"ממתין לאישור WhatsApp"**), and click **"סנכרון תבניות"** to demonstrate template
   management/sync.

> If a live connection cannot be completed during the recording, show the Embedded Signup
> popup opening and narrate that this is the standard Meta dialog. **Do not stage a fake
> "connected" state** — the demo panel will honestly show "not connected" until Embedded
> Signup is actually completed.

### Video B — `whatsapp_business_messaging` (real send + received)

Proves a real WhatsApp message is sent and received. This requires the connection from
Video A to be complete **and** the server-side real-send guards to be enabled.

1. On the **Automations** page, scroll to the **"סקירת Meta — מצב הדגמה"** panel.
2. Show the guard checklist — every row must be green:
   - שליחה אמיתית מופעלת (`ENABLE_REAL_WHATSAPP_SEND=true`)
   - ספק מוגדר ל-`meta_cloud_api` (`WHATSAPP_PROVIDER`)
   - חיבור WhatsApp פעיל לעסק (active per-business `WhatsAppConnection`)
   - תבנית הודעה מאושרת זמינה (approved template)
   - מספר נמען לבדיקה מוגדר (`WHATSAPP_TEST_PHONE`)
   - The panel shows the reviewer copy **"ניתן לשלוח הודעת בדיקה למספר שהוגדר לצורך סקירת Meta."**
3. Click **"שליחת הודעת בדיקה ל-Meta"**. The panel shows the provider **Message ID** and
   status (**sent**).
4. Switch to **WhatsApp Web / mobile** for the configured test number and show the message
   **received**.
5. (Optional) Back in Allura, show the message in the **יומן הודעות** (message log) with its
   delivery status updating from Meta's webhooks.

> The test send is fully guarded server-side (`sendReviewDemoTestMessage`). If any guard
> fails the button is disabled and the panel explains why — Allura never fakes a send and
> never shows a mock message as if WhatsApp delivered it. The message is only ever sent to
> the configured **test recipient** (`WHATSAPP_TEST_PHONE`), never to real clients.

### Enabling the messaging demo (server-side)

Set these on the review/demo environment **only** (never log the values):

```
ENABLE_REAL_WHATSAPP_SEND=true
WHATSAPP_PROVIDER=meta_cloud_api
WHATSAPP_TEST_MODE=true            # safest: blocks every recipient except the test number
WHATSAPP_TEST_PHONE=+9725XXXXXXXX  # the reviewer/our controlled test WhatsApp number
```

With `WHATSAPP_TEST_MODE=true`, the only number that can ever receive a message is
`WHATSAPP_TEST_PHONE`, so the live messaging demo cannot reach a real client.

---

## 6. Reviewer test notes

- **Where to log in.** Open https://allura.info and sign in with the test credentials
  provided to Meta in the App Review submission (username + password supplied in the
  "App Review" → test credentials field).
- **What account / test business to use.** Use the dedicated **reviewer test business**
  provisioned for this review. It contains sample clients, services, and bookings so the
  reviewer can see the full flow without affecting real data.
- **What button to click.** Go to the **Automations** page (`/automations`) and click
  **"חיבור WhatsApp Business"** to start Meta Embedded Signup. Use **"סנכרון תבניות"**
  to view template management, and trigger a reminder/manual message to see a send.
- **What behavior to expect.** After Embedded Signup completes, the connection status
  shows **"מחובר"** with the phone number. Template rows show their approval status.
  Sending a message records a status (sent/delivered/read/failed) in the message log.
- **Real sends remain gated.** By default Allura runs in a safe mode where **no real
  WhatsApp messages are delivered to clients**. The Automations page shows a banner —
  **"מצב בדיקה — הודעות לא נשלחות ללקוחות אמיתיים"** (test mode — messages are not sent to
  real clients). Real delivery only occurs when production WhatsApp credentials and the
  explicit send flag are configured server-side. This protects real users during review.
  If Meta needs to observe a live send, server-side test credentials / a test recipient
  number can be configured on request.

> **Note on the page URL:** the WhatsApp connection lives on the **Automations** page.
> In the running app this is reachable from the main navigation (Hebrew label
> **"אוטומציות"**) at the path `/automations`.

---

## 7. Safety notes

- **No credit card / payment-card data stored.** Allura does **not** store credit card or
  payment-card details. V1 deposit handling is manual status tracking only; there is no
  card storage.
- **No client card details stored.** No client payment-card information is collected or
  stored.
- **WhatsApp tokens encrypted at rest.** Each business's WhatsApp access token is
  encrypted at rest using **AES-256-GCM** (`src/lib/whatsapp/crypto.ts`) before being
  stored, and decrypted only server-side when sending. Tokens are never exposed to the
  browser.
- **All sends are per-business.** Each business connects its own WABA via Embedded Signup
  and messages only its own clients. Data and connections are tenant-isolated by
  `businessId`; one business can never message or read another business's clients.
- **Clients can opt out / unsubscribe.** Clients can reply **STOP** / **UNSUBSCRIBE** /
  **הסר** / **הסרה** to stop receiving messages. Allura records the opt-out and excludes
  those clients from further messaging.
- **STOP / הסר webhook is handled.** Incoming messages arrive at the WhatsApp webhook
  (`/api/whatsapp/webhook`). The request signature is verified with HMAC-SHA256. On a STOP
  keyword the client's `whatsappOptIn` / `marketingOptIn` flags are cleared and an
  `unsubscribedAt` timestamp is set, so the client is no longer messaged.

---

## 8. Submission checklist (internal)

- [x] App purpose documented (Hebrew RTL beauty CRM for Israel).
- [x] `whatsapp_business_messaging` justification (reminders, retention, manual booking
      messages — owner-configured, opt-in/opt-out enforced).
- [x] `whatsapp_business_management` justification (Embedded Signup + template sync +
      secure per-business storage).
- [x] Privacy Policy public at https://allura.info/privacy.
- [x] Terms public at https://allura.info/terms.
- [x] Support / data contact: support@allura.info.
- [x] Video script written.
- [x] Demo recording options documented (Video A: management / Embedded Signup + template
      sync; Video B: messaging / real send + received).
- [x] Admin/reviewer-only review-demo panel implemented (guard checklist + guarded test send,
      no faked sends, no secrets exposed).
- [x] Reviewer test notes written.
- [x] Safety notes written.
- [x] No "Beautiq" branding in public-facing / legal / App Review text (verified; remaining
      `Beautiq` references are local-dev only — DB user/volume names in `.env.example` and
      `docker-compose.yml` — and are not visible to clients or reviewers).
- [ ] Reviewer test credentials entered in the Meta App Review form (provide at submission).
- [ ] Screen recording uploaded to the Meta App Review submission.
