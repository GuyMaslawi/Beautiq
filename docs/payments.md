# Booking Payments & Clearing

Online payment / deposit support for the **public customer booking page**. This
is Phase 1: the product + backend foundation, a provider abstraction, a safe
**mock provider**, and a webhook/return architecture. **No real money moves by
default.** PayPlus / Grow-Meshulam / Tranzila are documented as the next
providers.

## PCI / safety note

- Allura **never** collects card details. The customer always pays on the
  provider's **hosted** secure page (payment-link flow).
- We **do not** store card numbers, CVV, or PAN — only an amount, a provider
  transaction reference, and a sanitized payload.
- Provider credentials are **AES-256-GCM encrypted** at rest
  (`PaymentProviderConnection.credentialsEncrypted`) and never returned to the
  client.

## Chosen booking behavior (Option A)

Public bookings are already created as `status: "pending"` (they await owner
approval and are **never auto-confirmed**). So requiring payment does not change
booking creation:

1. The booking is created `pending` exactly as before.
2. If the business requires a payment, a `BookingPayment` row + a hosted payment
   link are created, and the link is returned to the customer.
3. Payment is confirmed **only** by a verified provider **webhook**, which sets
   `BookingPayment.status = paid` and `Booking.depositStatus = paid`. The booking
   **stays `pending`** — the owner still approves it.

This never creates a *confirmed* booking without payment, and a client-side
"success" redirect is **never** treated as proof of payment.

> `allowPayAtBusiness` acts as a "pay at the business instead" escape hatch shown
> alongside a required payment. When `requirement = none`, no payment step is
> shown at all (the old flow is preserved).

## Data model

- **`BusinessPaymentSettings`** (1/business) — `enabled`, `provider`,
  `requirement` (`none|deposit|full_payment`), `depositType`
  (`fixed_amount|percentage`), `depositAmountMinor`, `depositPercentage`,
  `allowPayAtBusiness`, `instructions`.
- **`PaymentProviderConnection`** (1/business) — `provider`, `status`,
  `credentialsEncrypted`, `publicConfigJson`, `lastVerifiedAt`, `lastError`.
- **`BookingPayment`** (1/booking) — `provider`, `status`
  (`pending|payment_link_created|paid|failed|cancelled|expired|refunded`),
  `amountMinor`, `currency` (ILS), `paymentUrl`, `providerTransactionId`
  (unique — webhook idempotency key), `providerPayloadJson`, `paidAt`, `failedAt`.

**Money is stored in minor units (agorot, `Int`)** on these models — Israeli
providers work in agorot. This differs from the `Decimal(10,2)` major-unit
amounts elsewhere (`Service.price`); conversion happens at the boundary
(`src/lib/payments/money.ts`).

All queries are scoped by `businessId`.

## Provider abstraction

`src/lib/payments/provider.ts` — `PaymentProvider`:

- `createPaymentLink(input)` → `{ paymentUrl, providerTransactionId, expiresAt, metadata }`
- `getPaymentStatus(providerTransactionId)`
- `verifyWebhook({ rawBody, headers, secret })` → `boolean` (fail closed)
- `parseWebhook({ rawBody, headers, secret })` → normalized event

Per-business selection: `src/server/payments/resolver.ts`
(`resolvePaymentProviderForBusiness`). Mirrors the WhatsApp resolver.

### Mock provider (dev/test default)

The mock provider points the customer at an in-app hosted page
(`/pay/mock/[id]`) that simulates the provider checkout and fires the same
webhook a real provider would. The whole flow works end-to-end with no external
service and no real money.

## Routes

- `POST /api/payments/[provider]/webhook` — provider → server truth. Verifies
  the signature, parses, and applies the event **idempotently** (keyed on the
  unique `providerTransactionId`). Fails closed in production when a real
  provider's `PAYMENT_WEBHOOK_SECRET` is missing.
- `GET /api/payments/return/success` / `.../failure` — customer return URLs;
  redirect to `/pay/status` (which reads authoritative status from the DB).
- `/pay/status?bp=<id>` — Hebrew/RTL customer status page.
- `/pay/mock/[id]` — dev-only mock checkout page.

## Environment variables

Real payments require **all** of the following (otherwise the mock provider is
used and no real money moves):

| Var | Purpose |
| --- | --- |
| `PAYMENTS_ENABLED` | `true` to allow real (money-moving) providers globally |
| `PAYMENT_PROVIDER` | `payplus` \| `grow_meshulam` \| `tranzila` |
| `PAYMENT_WEBHOOK_SECRET` | webhook signature secret (required in production) |
| `PAYMENTS_CREDENTIALS_ENCRYPTION_KEY` | ≥32 chars / 32-byte hex/base64 — encrypts stored provider credentials |
| `NEXT_PUBLIC_APP_URL` | base URL for building return / webhook URLs |

A business must **also** have an active `PaymentProviderConnection` with valid
credentials. Even then, a real provider currently resolves to a disabled
provider that fails closed until its adapter is implemented (below).

## Webhook safety

- Signature verified per provider; **fail closed** when unsure.
- In production, a real provider with a missing `PAYMENT_WEBHOOK_SECRET` is
  rejected (403).
- **Idempotent**: re-delivery of a terminal event is a no-op — never
  double-confirms a booking or duplicates a payment.
- Scoped by the unique `providerTransactionId` (inherently per-business).
- A client redirect is **never** trusted as proof of payment.

## Tests never touch real providers

`test/setup.ts` clears the gating env, so `isRealPaymentsConfigured()` is always
`false` in tests and every resolution returns the mock provider. All
network/fetch is mocked. See `test/unit/payments-*` and
`test/integration/payments-*`.

## Rollout for a real provider (PayPlus / Grow-Meshulam / Tranzila)

1. Implement the provider adapter (`createPaymentLink` / `verifyWebhook` /
   `parseWebhook`) using the provider's **hosted payment page** API (not embedded
   card fields).
2. Wire it into `resolvePaymentProviderForBusiness` (replace the disabled
   fallback) and into the webhook route's `providerForKind`.
3. Store encrypted credentials in `PaymentProviderConnection`
   (`encryptCredentials`), set `status = active`.
4. Set `PAYMENTS_ENABLED=true`, `PAYMENT_PROVIDER=<provider>`,
   `PAYMENT_WEBHOOK_SECRET`, `PAYMENTS_CREDENTIALS_ENCRYPTION_KEY`.
5. Register the webhook URL `…/api/payments/<provider>/webhook` in the provider
   dashboard and verify signature handling end-to-end in a sandbox first.
