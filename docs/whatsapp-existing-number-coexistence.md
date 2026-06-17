# WhatsApp — Existing Business App Number / Coexistence Onboarding

This note explains how Allura supports connecting an **existing WhatsApp Business
App number** (coexistence) through Meta Embedded Signup, and exactly what must be
configured in the **Meta Developers dashboard** to make it work end-to-end.

> TL;DR: The Allura code already sends the supported Embedded Signup payload and
> now guides owners by intent. **Whether an existing WhatsApp Business App number
> can be connected (coexistence) is controlled by the Meta App configuration and
> the account's eligibility — not by an Allura runtime flag.** You most likely
> need to (re)configure the Embedded Signup / "Facebook Login for Business"
> configuration in Meta to enable the WhatsApp Business App onboarding feature,
> then point `NEXT_PUBLIC_META_CONFIG_ID` at it.

---

## 1. Current implementation audit

**Files**
- Launch (client): `src/components/whatsapp/whatsapp-connection-card.tsx`
- Completion (server): `src/server/whatsapp/embedded-signup-actions.ts`
- Graph calls: `src/lib/whatsapp/meta-onboarding.ts`
- Resolver / send gate: `src/server/whatsapp/resolver.ts`
- Track copy + helpers: `src/lib/whatsapp/connection-tracks.ts`

**Findings**

| Question | Answer |
| --- | --- |
| Are we using only the standard "add new phone number" flow? | We launch a single, standard `FB.login` Embedded Signup call with `config_id`, `response_type: "code"`, `override_default_response_type: true`, and `extras: { setup: {}, featureType: "", sessionInfoVersion: "3" }`. This is the generic Embedded Signup payload. It is **not** hard-coded to "new number only" — the available onboarding paths are decided by the Meta **configuration** behind `config_id`. |
| v1 or v2 Embedded Signup? | We use `sessionInfoVersion: "3"` and consume `waba_id` / `phone_number_id` from the `WA_EMBEDDED_SIGNUP` session-info `postMessage`. This is the current ("v2"/v3 session info) Embedded Signup, not the legacy v1. |
| Do we pass setup/extras that affect the onboarding path? | We pass `extras.setup` (empty) + `extras.featureType` (empty). There is no documented, stable runtime value that forces coexistence from the client; the path is configuration-driven. We keep `featureType` empty so the configuration decides. |
| Can the code receive an existing-business-app number if Meta returns one? | Yes. The completion action stores whatever `waba_id` + `phone_number_id` Meta returns and reads the real `display_phone_number` from the Graph API. It does not assume the number is brand-new. |
| Does the code assume every number is newly added? | No. `registerPhoneNumber()` is **idempotent** — a number that is "already registered" (error 133016 / "already registered") is treated as success. Nothing in the flow requires a fresh, never-registered number. |
| Does the code handle a coexistence-style result specially? | Meta does not reliably report "this was coexistence" back to the app. We therefore store the **owner's stated intent** as `connectionSource` for guidance + the confirmation step, and never claim coexistence as fact. |

**Conclusion:** Allura-side code already supports receiving and storing an existing
WhatsApp Business App number. The missing piece for a smooth "connect my existing
number" experience is **Meta dashboard configuration**, plus the UX guidance and
confirmation we added (below).

---

## 2. Required Meta dashboard configuration

Code-only changes are **not** sufficient to *guarantee* coexistence. To allow
business customers to onboard with an existing WhatsApp Business App number you
need an Embedded Signup configuration that enables that feature.

Do this in **developers.facebook.com → your App**:

1. **WhatsApp → Embedded Signup / Configurations** (under "Facebook Login for
   Business" configurations used by Embedded Signup).
2. Create or edit a configuration with:
   - **Login variation / type:** *Facebook Login for Business* (the one used by
     WhatsApp Embedded Signup).
   - **Assets / permissions:** `whatsapp_business_management`,
     `whatsapp_business_messaging` (already requested in our app review package).
   - **Feature:** select the **WhatsApp Embedded Signup** flow, and enable the
     option that allows onboarding **existing WhatsApp Business accounts / the
     WhatsApp Business App** (coexistence) where Meta exposes it for your app.
3. Copy the resulting **Configuration ID** and set it as
   `NEXT_PUBLIC_META_CONFIG_ID`.
4. Keep the same **App ID** in both `META_APP_ID` (server) and
   `NEXT_PUBLIC_META_APP_ID` (client) — `NEXT_PUBLIC_META_APP_ID` does **not**
   need to change unless you create a new app.

### Should it support…?

- **Existing WhatsApp Business App users** — yes, this is the goal of the new
  configuration.
- **Coexistence** — yes, where Meta makes it available for your app/account.
  Eligibility is per-account and per-number; not every number qualifies.
- **Onboarding Business App users** — yes.
- **WhatsApp Business Platform / Cloud API** — yes; coexistence still results in a
  Cloud API connection (WABA + phone number id + token), which is exactly what
  our completion action stores.

### Env to update

| Env var | Change? |
| --- | --- |
| `NEXT_PUBLIC_META_CONFIG_ID` | **Yes** — point to the new coexistence-enabled configuration. |
| `NEXT_PUBLIC_META_APP_ID` | Usually **no** (unchanged App ID). |
| `META_APP_ID` / `META_APP_SECRET` | No (unchanged). |
| `WHATSAPP_CREDENTIALS_ENCRYPTION_KEY` | No (already required for Mode B). |

### App Review implications

- The permissions we already request (`whatsapp_business_management`,
  `whatsapp_business_messaging`) cover coexistence onboarding — no new permission
  is introduced by enabling the existing-number path.
- If the review video/notes describe a "new number" demo, update them to mention
  that owners may also connect an existing WhatsApp Business App number. See
  `docs/meta-app-review-package.md`.
- No change to data handling, storage, or opt-out behavior, so the safety section
  of the review package remains accurate.

---

## 3. What changed in Allura (this work)

**Code only — no Meta calls were added or changed in a way that bypasses Meta.**

- **Pre-connection chooser** before launching Meta, with three guided tracks:
  *existing WhatsApp Business* (recommended), *personal WhatsApp* (discouraged,
  with an acknowledgement gate), and *new number*.
- The chosen track is sent to the completion action as `intent` and stored on
  `WhatsAppConnection.connectionSource` (guidance only — never presented as a
  verified Meta fact).
- **Already-registered error handling:** if the popup surfaces an
  already-registered / migrate / in-use error, the owner sees a friendly Hebrew
  explanation with actions ("try again with existing WhatsApp Business", "use a
  new number", "got it") instead of a raw Meta error. Raw detail is admin-only.
- **Connected-number confirmation:** a guided-flow connection starts
  **unconfirmed**. The owner must press "זה המספר הנכון" before any real send.
  Until confirmed, the server resolver returns a disabled provider, so no message
  is sent. A `+1 555` Meta test number triggers an extra warning.

The standard "new number" Embedded Signup flow and the existing callback / code
exchange are unchanged.

---

## 4. Owner-facing guidance (copy already in the UI)

- "לא תמיד צריך מספר חדש."
- "אם יש לך WhatsApp Business App, ייתכן שאפשר לחבר את אותו מספר."
- "אם יש לך WhatsApp אישי רגיל, מומלץ לא לחבר אותו."
- "אם Meta חוסמת מספר שכבר רשום, זו דרישה של Meta — לא תקלה ב־Allura."
