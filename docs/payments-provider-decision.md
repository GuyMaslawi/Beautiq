# Payments Provider Decision — Allura Phase 1

**Status:** Decision doc only. No implementation, no flow changes, no new dependencies.
**Date:** 2026-06-15
**Scope:** Choose the first real Israeli payment provider to plug into Allura's existing payment abstraction.

---

## 1. Recommendation

**Start with PayPlus.** Add **Grow (Meshulam)** as the second adapter.

PayPlus is the best fit for Allura Phase 1 because it satisfies every hard requirement with the least friction:

- **No monthly fee, no setup fee** — pay-per-transaction only (~1.5% card, ~1.6% Bit), no minimum commitment.
- **Aggregated clearing (סליקה מאגדת)** — the business owner does **not** need a separate acquirer agreement with the credit-card companies. They sign up directly with PayPlus. This is the single biggest onboarding win for non-technical beauty businesses.
- **Hosted payment page via a clean Generate-Link REST API** (`PaymentPages/GenerateLink`) — returns a payment URL we redirect the client to. We never see or store card data.
- **Webhooks with HMAC signature verification** (`callback_url`) — maps directly onto our existing `verifyWebhook` / `parseWebhook` contract.
- **Israel + ILS native**, supports **Bit, Apple Pay, Google Pay**, major cards.
- **PCI scope = SAQ-A** for us (hosted page; cards entered on PayPlus's PCI-DSS Level 1 environment).
- Modern, documented REST API (English + Hebrew) at `docs.payplus.co.il`.

Allura's Prisma enum `PaymentProviderKind` already includes `payplus`, `grow_meshulam`, and `tranzila`, so choosing PayPlus needs **no schema migration**. (Invoice4U and Cardcom are not in the enum and would require one.)

Grow is the strongest runner-up (fastest same-day self-signup, also aggregated clearing) and is a natural second adapter. Tranzila, Invoice4U, and Cardcom are not recommended for Phase 1 (reasons below).

---

## 2. How this fits Allura's existing architecture

Our abstraction is already shaped exactly for a hosted-page + webhook provider, so PayPlus drops in cleanly:

| Our contract (`src/lib/payments/provider.ts`) | PayPlus equivalent |
|---|---|
| `createPaymentLink(input)` → payment URL + transaction id | `POST PaymentPages/GenerateLink` → payment page URL + `page_request_uid` |
| `verifyWebhook(input)` | HMAC signature header verification on `callback_url` |
| `parseWebhook(input)` → normalized event | parse callback body → `paid` / `failed` / etc. |
| `getPaymentStatus(id)` | status query by transaction / page request uid |
| `providerTransactionId` (unique, idempotency key) | `page_request_uid` / transaction uid |
| `credentialsEncrypted` (AES-256-GCM per business) | API key + secret key + terminal/page uid |

Resolver (`src/server/payments/resolver.ts`) already gates on env (`PAYMENTS_ENABLED`, `PAYMENT_PROVIDER`) plus per-business `PaymentProviderConnection`, and falls back to the mock provider. The PayPlus adapter only needs to replace the current "disabled" fallback for `provider === "payplus"`.

---

## 3. Provider comparison

Legend: ✅ yes · ⚠️ partial / with caveats · ❌ no / not ideal

| Criterion | **PayPlus** | **Grow (Meshulam)** | **Invoice4U** | **Tranzila** | **Cardcom** |
|---|---|---|---|---|---|
| Hosted payment page / payment link API | ✅ Generate-Link REST API | ✅ Hosted checkout + payment links | ⚠️ Pay-by-Link, mostly via Verifone | ✅ iFrame redirect + Hosted Fields | ✅ "Low Profile" hosted page |
| Webhooks / callbacks | ✅ `callback_url` + HMAC | ✅ notification URL | ⚠️ via Verifone integration | ✅ `notify_url` | ✅ webhook callbacks |
| Israeli businesses | ✅ | ✅ | ✅ | ✅ | ✅ |
| ILS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bit / Apple Pay / Google Pay | ✅ Bit, Apple Pay (+wallets) | ✅ Bit, Apple Pay, Google Pay | ⚠️ depends on backend | ⚠️ card-first, wallets vary | ⚠️ varies by plan |
| No monthly / no setup fee | ✅ ~1.5% only, no monthly | ⚠️ pay-by-use 1.7%+₪1, no monthly | ⚠️ invoicing tiers, add-on fees | ⚠️ no-monthly tier for low volume | ❌ typically monthly fee |
| Aggregated clearing (no separate acquirer) | ✅ | ✅ | ✅ | ⚠️ Merchant Express only; otherwise own acquirer | ❌ usually own acquirer |
| Developer docs quality | ✅ modern, EN+HE | ⚠️ good, hosted-focused | ❌ invoice-centric | ⚠️ dated | ✅ modern REST |
| Integration effort for us | ✅ low | ✅ low | ❌ higher / indirect | ⚠️ medium (dated docs) | ✅ low (but cost) |
| PCI scope for Allura | ✅ SAQ-A (hosted) | ✅ SAQ-A (hosted) | ✅ hosted | ⚠️ SAQ-A iframe / higher if Hosted Fields | ✅ SAQ-A (hosted) |
| In our Prisma enum already | ✅ `payplus` | ✅ `grow_meshulam` | ❌ (needs migration) | ✅ `tranzila` | ❌ (needs migration) |

### Notes per provider

- **PayPlus** — Best all-round fit. No monthly/setup fee, aggregated clearing, clean Generate-Link API + HMAC webhooks, Bit/Apple Pay, SAQ-A. **Recommended primary.**
- **Grow (Meshulam)** — Fastest self-signup (often same-day), aggregated clearing, Bit + wallets, payment links + webhooks. Slightly more hosted-checkout-oriented and per-transaction cost a touch higher (1.7%+₪1). **Recommended secondary adapter.**
- **Invoice4U** — Primarily an invoicing product; online payment is largely surfaced through a Verifone integration rather than a clean first-party hosted-page API. Good if we later want built-in green-invoice generation, but more indirect to integrate now. **Not Phase 1.**
- **Tranzila** — Capable and cheap, but docs are dated and the no-acquirer path (Merchant Express) is narrower; full gateway typically expects the business to hold its own acquirer agreement, which hurts our onboarding. **Keep as future option (already in enum).**
- **Cardcom** — Modern REST API and strong recurring billing, but generally carries setup/monthly fees and leans toward businesses with their own acquirer — contradicts "cheapest/easiest, no monthly fee." Better fit if we later need heavy subscription billing. **Not Phase 1.**

---

## 4. Credentials Allura would need (PayPlus)

Collected per business and stored **encrypted** in `PaymentProviderConnection.credentialsEncrypted` (AES-256-GCM, existing pattern):

- **API Key** (`api_key`)
- **Secret Key** (`secret_key`)
- **Payment Page UID** / terminal page uid (identifies which hosted page/terminal to charge)
- **Webhook signing secret** (for HMAC verification of `callback_url` calls) — can also live in `PaymentProviderConnection` rather than global env

Non-secret config (terminal label, page uid display) can go in `PaymentProviderConnection.publicConfigJson`.

---

## 5. Onboarding for a business owner (PayPlus, target flow)

1. Owner opens an account at PayPlus (aggregated clearing — no separate credit-company agreement needed). Approval is typically fast for standard categories.
2. Owner gets API Key, Secret Key, and a Payment Page UID from the PayPlus dashboard.
3. In Allura settings → תשלומים, owner selects "PayPlus" and pastes the keys (Hebrew-only UI, RTL).
4. Allura encrypts and stores them, sets `PaymentProviderConnection.status = active`, and shows a connection status indicator (we already render Hebrew status detail).
5. Owner sets the payment policy (none / full payment / pay at business — Allura does **not** support deposits) and is live.

No card data ever touches Allura.

---

## 6. Rollout steps (when we implement — not now)

1. **Build the PayPlus adapter** implementing `PaymentProvider` (`createPaymentLink`, `getPaymentStatus`, `verifyWebhook`, `parseWebhook`) against `PaymentPages/GenerateLink` + callback.
2. **Wire the resolver** so `provider === "payplus"` with active credentials returns the real adapter instead of the disabled fallback.
3. **Wire the webhook route** `/api/payments/[provider]/webhook` for `payplus` (currently only `mock` is mapped). Reuse existing idempotency via `providerTransactionId` and the production `PAYMENT_WEBHOOK_SECRET` gate.
4. **Settings UI** — add PayPlus credential fields to the payments settings form (Hebrew, RTL), with a "test connection" affordance.
5. **Sandbox test** end-to-end against `restapidev.payplus.co.il`: create link → pay → receive webhook → `BookingPayment.paid` (the booking stays `pending` for owner approval).
6. **Pilot** with one or two real businesses in production behind the env gate before wider rollout.
7. **Add Grow adapter** next, reusing the same contract and webhook plumbing.

---

## 7. Environment variables needed

Existing gates (already used by the resolver/webhook) — set for production:

- `PAYMENTS_ENABLED=true`
- `PAYMENT_PROVIDER=payplus`
- `PAYMENT_WEBHOOK_SECRET=...` (global fallback; per-business secret preferred)
- `PAYMENTS_CREDENTIALS_ENCRYPTION_KEY=...` (≥32 chars; already required for encryption at rest)
- `NEXT_PUBLIC_APP_URL` / `APP_URL` (base URL for building return + webhook URLs)

PayPlus-specific (new, used by the adapter — likely just to switch API host between dev/prod):

- `PAYPLUS_API_BASE_URL` — `https://restapidev.payplus.co.il` (dev) / `https://restapi.payplus.co.il` (prod)

Per-business credentials (API key, secret key, page uid, webhook secret) are **not** env vars — they live encrypted in `PaymentProviderConnection`.

---

## 8. Open questions to confirm with PayPlus

1. **Webhook signature** — exact header name, payload format, and HMAC algorithm/secret used for `callback_url` verification.
2. **Idempotency / retries** — webhook retry policy and which field is the stable unique id (`page_request_uid` vs transaction uid) to use as our `providerTransactionId`.
3. **Status model** — full list of callback statuses and how refunds / cancellations / expiry are reported (to map to our `BookingPaymentStatus`).
4. **Bit & Apple Pay** — whether these are enabled by default on a new merchant or require separate activation, and any extra fee.
5. **Sandbox** — sandbox/test credentials and test cards for `restapidev`.
6. **Fees** — confirm current rate card in writing (card %, Bit %, installments, payout timing) and that there is genuinely no monthly/setup fee for our expected volume.
7. **Settlement** — payout schedule (24h?) and minimum for full payments.
8. **Onboarding/KYC** — documents a small עוסק פטור/מורשה must provide and typical approval time.
9. **Refunds API** — endpoint and constraints (we may want owner-initiated refunds later).
10. **Multi-tenant** — confirm one Allura integration can serve many independent PayPlus merchant accounts (per-business keys), with no platform-level account required.

---

### Sources

- [PayPlus — Generate Payment Link API](https://docs.payplus.co.il/reference/post_paymentpages-generatelink)
- [PayPlus — Hosted Fields / Payment Methods](https://docs.payplus.co.il/reference/payment-methods)
- [PayPlus — official site (fees, no monthly fee, Bit/Apple Pay)](https://www.payplus.co.il/)
- [Grow (Meshulam) — fees](https://grow.business/fees/)
- [Grow by Meshulam — payment provider overview (Wix)](https://support.wix.com/en/article/connecting-grow-by-meshulam-as-a-payment-provider)
- [Tranzila — Payment request / API V2 docs](https://docs.tranzila.com/docs/payments-billing/c7do32dbrot42-tranzila-api-v2)
- [Tranzila — Merchant Express (small business, 24h, aggregated)](https://www.tranzila.com/merchant-express.html)
- [Invoice4U via Verifone — Pay by Link / eComm API](https://verifone.cloud/docs/online-payments/payment-documents/invoice4u)
- [Cardcom — WordPress plugin / REST gateway](https://wordpress.org/plugins/woo-cardcom-payment-gateway/)
- [Tranzila vs Cardcom vs Meshulam comparison](https://danielmashkov.com/insights/israeli-payment-gateways-comparison)
- [On aggregated clearing for small businesses (Grow fees)](https://grow.business/fees/)
