# Allura — First Customer Checklist

Practical, grounded checklist for onboarding the **first paying business** before
PayPlus and automated billing exist. Everything here reflects the code as it is
today: WhatsApp is real (Meta Cloud API + Embedded Signup), payments are **off**
(`mock` only), and billing/subscription is **manual**.

> Sources of truth in the repo:
> - Env validation: [src/lib/env.ts](../src/lib/env.ts) (fails fast on boot via [instrumentation.ts](../instrumentation.ts))
> - Env reference: [.env.example](../.env.example)
> - Health endpoint: [src/app/api/health/route.ts](../src/app/api/health/route.ts)
> - WhatsApp connect UI: [src/components/whatsapp/whatsapp-connection-card.tsx](../src/components/whatsapp/whatsapp-connection-card.tsx)

---

## 1. Required production environment variables

`checkEnv()` runs on server boot and **throws in production** on any error. Set
these in your host (Vercel → Project → Settings → Environment Variables) for the
Production environment.

### Always required (boot fails without them)
| Variable | Purpose | How to generate |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | from your DB provider (Neon/Supabase/RDS) |
| `AUTH_SECRET` | session signing (Auth.js) | `openssl rand -base64 32` |

### Required in production
| Variable | Purpose | How to generate |
|---|---|---|
| `CRON_SECRET` | authorizes incoming `/api/cron/*` calls (401 without it) | `openssl rand -hex 32` |
| `AUTH_URL` | full app domain for auth redirects | e.g. `https://app.allura.info` |
| `NEXT_PUBLIC_APP_URL` | base for external links in WhatsApp/booking messages (defaults to `https://allura.info` with a warning) | your real domain |

### Required to actually send WhatsApp (when `ENABLE_REAL_WHATSAPP_SEND=true`)
| Variable | Purpose |
|---|---|
| `ENABLE_REAL_WHATSAPP_SEND=true` | master switch; **false = nothing is sent** (safe dev mode) |
| `WHATSAPP_PROVIDER=meta_cloud_api` | provider selector |
| `META_WHATSAPP_ACCESS_TOKEN` | Meta Cloud API token (env-fallback mode) |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Meta phone number id (env-fallback mode) |
| `META_WEBHOOK_APP_SECRET` | **required in prod** — verifies inbound webhook HMAC signature |
| `META_WEBHOOK_VERIFY_TOKEN` | webhook registration token (also set in Meta dashboard); `openssl rand -hex 16` |

### Required for per-business Embedded Signup ("connect with one click")
| Variable | Purpose | How to generate |
|---|---|---|
| `WHATSAPP_CREDENTIALS_ENCRYPTION_KEY` | AES-256-GCM key encrypting each business's token at rest | `openssl rand -hex 32` |
| `META_APP_ID` / `META_APP_SECRET` | server-side, exchanges the auth code for the business token | Meta App → Settings → Basic |
| `NEXT_PUBLIC_META_APP_ID` | client-side, loads the Facebook SDK | same App ID |
| `NEXT_PUBLIC_META_CONFIG_ID` | "Facebook Login for Business" configuration id | Meta App → FB Login for Business → Configurations |
| `NEXT_PUBLIC_META_GRAPH_VERSION` | optional, defaults to `v19.0` | — |

> **Note on the two WhatsApp modes:**
> - **Env-fallback (pilot):** `WHATSAPP_USE_ENV_FALLBACK=true` — one global Meta number used for all businesses. Simplest for the very first customer.
> - **Per-business (production):** `WHATSAPP_USE_ENV_FALLBACK=false` — each owner connects their own number via Embedded Signup. Requires the encryption key + Meta App ID/Secret/Config ID above.
> If the connect button is disabled and shows "חיבור WhatsApp עדיין לא זמין", `NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_CONFIG_ID` are missing.

### Must NOT leak into production
| Variable | Why |
|---|---|
| `WHATSAPP_TEST_MODE=true` | restricts real sends to `WHATSAPP_TEST_PHONE` only — keep `true` during the pilot, flip to `false` only after full sign-off |
| `SKIP_ENV_VALIDATION=true` | CI/build only — never in prod |
| `PAYMENTS_ENABLED` | leave `false` (PayPlus not implemented yet) |

---

## 2. Meta / WhatsApp readiness

- [ ] Meta App created; **App ID + App Secret** recorded.
- [ ] "Facebook Login for Business" configuration created; **Config ID** recorded (the expected config id is referenced in [embedded-signup-launch.ts](../src/lib/whatsapp/embedded-signup-launch.ts)).
- [ ] WhatsApp Business product added to the Meta App; a phone number provisioned **or** the owner has an existing WhatsApp Business number to connect (coexistence — see [docs/whatsapp-existing-number-coexistence.md](whatsapp-existing-number-coexistence.md)).
- [ ] Webhook registered in Meta dashboard → `https://<your-domain>/api/whatsapp/webhook`, with `META_WEBHOOK_VERIFY_TOKEN` matching the env value, subscribed to message status events.
- [ ] Message templates submitted and **approved** by Meta (operational first: confirmation, reminder; marketing/win-back is optional and never blocks core setup).
- [ ] Confirm the connected number is **not** a Meta `+1 555` test number — the connection card flags this for admins.
- [ ] App is in **Live** mode (not Development) if sending to real customers beyond test numbers.
- [ ] Health check confirms config: `GET /api/health` with `Authorization: Bearer <CRON_SECRET>` returns `config.realWhatsAppSend`, `whatsAppTestMode`, `whatsAppEncryptionKeySet`, and `env.errors: []`.

---

## 3. Manual subscription setup (no PayPlus yet)

Billing is manual for v1 — there is no payment provider for the subscription.

- [ ] Agree price + cycle with the owner out-of-band (bank transfer / Bit / invoice).
- [ ] Issue an invoice/receipt manually per your accounting process.
- [ ] Track the subscription in a simple external sheet: business name, slug, start date, amount, next-renewal date, status.
- [ ] Set a personal reminder for the renewal date (there is no in-app dunning).
- [ ] Decide and document the access policy on non-payment (e.g. manual account disable) — there is no automated gating.

---

## 4. Test business setup (rehearse before the real one)

The repo ships a demo seed for exactly this rehearsal:

```bash
npm run db:demo
```

Creates **הסטודיו של יעל** (`yael-studio`), owner `demo@allura.local` / `Demo123456!`,
with services, availability, 6 clients and 12 bookings. Safe to re-run; scoped to
that slug. Public booking page: `/<domain>/b/yael-studio`.

- [ ] Walk every core screen (dashboard, bookings, clients, bring-back, waitlist, automations, public page).
- [ ] Place a public booking through `/b/yael-studio`; confirm it appears as `pending` in the dashboard.
- [ ] With `WHATSAPP_TEST_MODE=true` + your own number as `WHATSAPP_TEST_PHONE`, send one real test message from the automations admin panel.
- [ ] **Do not** seed demo data into the production DB used by the real customer.

---

## 5. First owner onboarding steps

1. Create the owner's account (signup) and their **Business** (name, categories, slug).
2. Fill business profile + address note ([/settings](../src/app/(app)/settings)).
3. Set **availability** (working hours + exceptions).
4. Add **services** (name, duration, price, deposit if required).
5. Import or add **clients** (clients page supports import).
6. **Connect WhatsApp** from `/automations` → "חיבור WhatsApp Business" → choose number track → finish in the Meta popup → confirm the connected number.
7. Verify templates show ready/pending (owner sees one calm status banner; admin sees the full diagnostics table).
8. Enable the automations the owner wants (reminders, confirmations, bring-back).
9. Share the public booking link `/<domain>/b/<slug>`.
10. Do a live end-to-end test: book → confirm → send the confirmation message to a real number.

---

## 6. Rollback plan

- **Deploy rollback:** redeploy the previous green build (Vercel → Deployments → Promote previous). The app is stateless; only env + DB persist.
- **Kill switch for sends (no redeploy):** set `ENABLE_REAL_WHATSAPP_SEND=false` (or `WHATSAPP_TEST_MODE=true`) and redeploy/restart — all real sends stop immediately, safely.
- **Disable a single business's WhatsApp:** owner (or admin) clicks "ניתוק WhatsApp" on the connection card.
- **Database:** take a snapshot/backup **before** onboarding the first real customer; know your provider's point-in-time-restore window. Prisma migrations are forward-only — test any new migration on a copy first.
- **Payments:** already off (`PAYMENTS_ENABLED=false`), so there is no money-movement to roll back.

---

## 7. What to monitor during the first week

- [ ] **Uptime / DB:** `GET /api/health` returns `200` `{status:"ok", checks.database:"ok"}`; `503` means DB down. Poll it externally (UptimeRobot/Better Uptime).
- [ ] **Boot env validation:** check deploy logs for `checkEnv` errors/warnings on startup; or `GET /api/health` with the `CRON_SECRET` bearer to read `env.errors`/`env.warnings`.
- [ ] **Cron jobs firing:** morning-reminder, review-request, win-back ([src/app/api/cron/*](../src/app/api/cron)) — confirm they run on schedule and return 200 (401 = bad/missing `CRON_SECRET`).
- [ ] **WhatsApp delivery:** sent vs delivered vs failed (the connected summary on `/automations` shows weekly counts); investigate any spike in failures.
- [ ] **Webhook health:** Meta delivery status callbacks arriving and passing signature verification; STOP/opt-out handled.
- [ ] **Template status:** no templates slipping to `rejected`; marketing rejection is non-blocking but worth noting.
- [ ] **Errors/logs:** application errors via your host's logs (structured logger in [src/lib/logger.ts](../src/lib/logger.ts)).
- [ ] **Booking flow integrity:** public bookings landing as `pending`, owner approving them, no double-bookings.
- [ ] **Owner sentiment:** a quick check-in with the first owner mid-week — the real signal that onboarding worked.

---

### Out of scope (intentionally, for v1)
PayPlus / real payment provider, automated subscriptions/billing, dunning. Keep
`PAYMENTS_ENABLED=false`. These come after the first customers validate the core.
