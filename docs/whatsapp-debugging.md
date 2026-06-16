# WhatsApp delivery — debugging guide

This guide explains why a WhatsApp message was **sent, skipped, blocked, or
failed**, and how to send one real controlled test message safely.

A "message not sent" is never one generic failure. Every attempt is recorded as
an `AutomationMessage` with a status and a safe `failureReason`, and the admin
panel **בדיקת שליחת WhatsApp** (in `/automations`) shows the exact reason.

---

## 1. The send pipeline at a glance

```
trigger → _send guards → resolver → provider → Meta Cloud API
```

1. **Trigger** — booking confirmation is immediate; reminders / review / win-back
   are cron. See §6.
2. **Eligibility guards** — valid phone, opt-out, opt-in, template, cooldown.
3. **Resolver** (`src/server/whatsapp/resolver.ts`) — decides which provider to
   use (real Meta, dev mock, disabled) based on env + the per-business
   `WhatsAppConnection`.
4. **Provider** (`src/lib/whatsapp/provider.ts`, `meta-cloud-api.ts`) — performs
   the actual HTTP send, or blocks it in test mode.

Every step records a reason. The stable reason codes live in
`src/server/whatsapp/reasons.ts`.

---

## 2. Env flags required for a real send

A real HTTP call to Meta happens **only when all of these hold**:

| Flag | Required value | Notes |
|------|----------------|-------|
| `ENABLE_REAL_WHATSAPP_SEND` | `true` | Master switch. If not `true`, everything uses the dev mock (nothing is sent). |
| `WHATSAPP_PROVIDER` | `meta_cloud_api` | Only supported provider. |
| `META_WHATSAPP_ACCESS_TOKEN` | set | Mode A (env fallback) token. Never logged. |
| `META_WHATSAPP_PHONE_NUMBER_ID` | set | Meta phone-number id (not the display number). |
| A usable connection | — | Either an active per-business `WhatsAppConnection`, or `WHATSAPP_USE_ENV_FALLBACK=true` with the env credentials above. |
| An **approved** template | — | `AutomationSetting.templateName` with `templateStatus = "approved"`. |

Plus, **if test mode is on**, the recipient must be the test phone (§3).

---

## 3. How test mode works

```
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_PHONE=+972544961155
```

When `WHATSAPP_TEST_MODE=true`, the real provider is wrapped by a guard that
**only allows sends to `WHATSAPP_TEST_PHONE`**. Every other recipient is blocked
and recorded as `skipped` with reason
`test_mode_recipient_mismatch` ("מצב בדיקה — שליחה מותרת רק למספר הבדיקה").

This is the most common reason a real client did not receive a message: the
booking confirmation fired, but test mode withheld it because the client is not
the test number.

The recipient comparison is **format-agnostic** — `+972544961155`,
`972544961155`, and `0544961155` are all treated as the same number
(`phonesEqual` in `src/lib/phone.ts`). Configure `WHATSAPP_TEST_PHONE` in E.164
(`+972…`); any reasonable Israeli format also works.

If `WHATSAPP_TEST_PHONE` is empty while test mode is on, **all** sends are
blocked (`test_phone_not_set`).

---

## 4. Transactional vs marketing opt-in

| Message type | Category | Opt-in required |
|--------------|----------|-----------------|
| Booking confirmation | transactional | `requireOptIn` defaults to **false**. Marketing opt-in is **not** required. |
| Appointment reminder | transactional | Only if the automation's `requireOptIn=true`. No marketing opt-in. |
| Review request | transactional | Only if `requireOptIn=true`. No marketing opt-in. |
| Win-back / return customers | **marketing** | Always requires `marketingOptIn=true` (plus `whatsappOptIn` if `requireOptIn=true`). |

In all cases, a client with `unsubscribedAt` set is never messaged.

> Booking confirmations must **not** be blocked by `marketingOptIn=false` — they
> are transactional. The diagnostics dry-run proves this.

---

## 5. Reason codes

`src/server/whatsapp/reasons.ts` defines the stable codes shown in the audit
trail and diagnostics panel:

`ok`, `missing_connection`, `real_send_disabled`, `dev_mode`,
`test_mode_recipient_mismatch`, `test_phone_not_set`, `missing_template`,
`template_not_approved`, `invalid_phone`, `unsubscribed`, `missing_opt_in`,
`missing_marketing_opt_in`, `cooldown`, `provider_error`, `no_trigger`,
`unknown`.

Meta provider failures additionally carry Meta's own safe error fields in the
reason text: `message [code … · type … · subcode … · trace …]` (no secrets).
Use the `trace` (`fbtrace_id`) when contacting Meta support.

---

## 6. Cron vs immediate

| Message | When |
|---------|------|
| **Booking confirmation** | **Immediate** — when an owner creates an approved booking, approves a pending one, or a public request is submitted. |
| Appointment reminder | Cron (`/api/cron/morning-reminder`). |
| Review request | Cron (`/api/cron/review-request`), after completion. |
| Win-back | Cron (`/api/cron/win-back`) or manual run. |

Note: paying for a booking online does **not** auto-confirm it. The booking
stays `pending` until the owner approves it, which is what fires the
confirmation.

---

## 7. Step-by-step: why didn't this message send?

1. Open `/automations` as an admin → **בדיקת שליחת WhatsApp**.
2. Pick the message type (and a client, if relevant).
3. Click **בדיקת זכאות לשליחה** (dry-run — sends nothing).
4. Read the checklist. The first ✗ is the block reason, with its code.
5. Cross-check the **יומן הודעות** log for the actual recorded
   `AutomationMessage` status + `failureReason`.

Common outcomes:

- **`real_send_disabled`** → set `ENABLE_REAL_WHATSAPP_SEND=true`.
- **`test_mode_recipient_mismatch`** → the client isn't the test number. Either
  send to the test number, or turn test mode off for real delivery (deliberate).
- **`missing_template` / `template_not_approved`** → create/sync templates and
  wait for Meta approval (admin WhatsApp panel).
- **`invalid_phone`** → fix the client's phone.
- **`unsubscribed`** → the client sent STOP; they must opt back in.
- **`missing_marketing_opt_in`** (win-back only) → expected for non-consented
  clients.

---

## 8. Send one real controlled test message

This sends exactly **one** message to `WHATSAPP_TEST_PHONE`, through the guarded
path, and logs it. It never fakes a send.

1. Ensure:
   - `ENABLE_REAL_WHATSAPP_SEND=true`
   - `WHATSAPP_PROVIDER=meta_cloud_api`
   - active connection (or `WHATSAPP_USE_ENV_FALLBACK=true` + env creds)
   - at least one **approved** template
   - `WHATSAPP_TEST_PHONE` = a WhatsApp number **you** control
     (with test mode on, this is the only number that can receive).
2. Go to `/automations` → **בדיקת שליחת WhatsApp**.
3. Run **בדיקת זכאות לשליחה** with type **הודעת בדיקה** and confirm every check
   is ✓.
4. Click **שליחת הודעת בדיקה**.
5. Check the device on `WHATSAPP_TEST_PHONE`, and the **יומן הודעות** log for the
   `sent` row + provider message id.

To send to a real customer in production, turn **off** test mode
(`WHATSAPP_TEST_MODE=false`) only when you intend real delivery — this is a
deliberate operation, not a debugging step.
