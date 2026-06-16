# Allura — Production Readiness Audit

**Date:** 2026-06-15
**Scope:** Audit + small safe hardening before enabling real WhatsApp/Meta sending.
**Context:** Allura is a Hebrew-only RTL multi-tenant SaaS CRM for beauty businesses in Israel. The internal CRM is for business owners only; end customers see only the public booking page. We are awaiting Meta Business Verification / WhatsApp approval. Real WhatsApp sending must stay disabled until production guards are explicitly enabled.

This was an audit, not a feature pass. Only small, safe fixes were made (listed under **Fixes made**). No features were added and no pages were redesigned.

---

## TL;DR

- **Overall: production-ready for everything except live WhatsApp sending**, which correctly remains gated off.
- The WhatsApp/Meta safety layer is strong: defaults to a dev mock, fails closed on every misconfiguration, never logs tokens, encrypts tokens at rest (AES-256-GCM), and uses a per-business resolver.
- Auth, multi-tenant isolation, public-data exposure, and the Prisma schema all passed review with no high-severity issues.
- A real gate gap was found and fixed: `npm run typecheck` failed from a cold cache on 3 type errors in untracked test files (Next build does not type-check test files, so it masked this).
- Two customer-facing **`beautiq.co`** old-brand leftovers in review messages were fixed.
- The webhook now **fails closed in production** when the app secret is missing.

**Gate status after fixes:** `typecheck` ✅ · `lint` ✅ (0 warnings) · `test` ✅ 727 passed (72 files) · `build` ✅

---

## 1. Environment variables

**Status: PASS (with notes).** All required envs are documented in `.env.example` and consumed safely.

| Variable | Documented | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Consumed by Prisma; missing → Prisma throws at startup (fails safe). |
| `AUTH_SECRET` | ✅ | Auth.js (NextAuth v5). Required in production. |
| `AUTH_URL` / host | ✅ | `trustHost: true` in dev; set full domain in prod. Example domain corrected to `app.allura.info`. |
| `ENABLE_REAL_WHATSAPP_SEND` | ✅ | Master kill-switch. Default `false` → dev mock, no real send. |
| `WHATSAPP_PROVIDER` | ✅ | `meta_cloud_api`. Unknown value → disabled provider. |
| `WHATSAPP_TEST_MODE` | ✅ | Default `true`. Only `WHATSAPP_TEST_PHONE` may receive real sends. |
| `WHATSAPP_TEST_PHONE` | ✅ | Required when test mode active, else sends blocked. |
| `WHATSAPP_USE_ENV_FALLBACK` | ✅ | Default `false` → per-business connection required in prod. |
| `META_WHATSAPP_ACCESS_TOKEN` | ✅ | Env-fallback/Mode-A token. Never logged. |
| `META_WHATSAPP_PHONE_NUMBER_ID` | ✅ | Missing → disabled provider. |
| `META_WHATSAPP_API_VERSION` | ✅ | Optional, defaults `v19.0`. |
| `META_WHATSAPP_WABA_ID` | ✅ | Optional, debug/template fetch. |
| `WHATSAPP_CREDENTIALS_ENCRYPTION_KEY` | ✅ | AES-256-GCM key for Mode-B tokens. Required in prod. |
| `META_APP_ID` / `META_APP_SECRET` | ✅ | Server-side, Embedded Signup token exchange. |
| `NEXT_PUBLIC_META_APP_ID` | ✅ | Public — same App ID, safe to expose (loads FB SDK). |
| `NEXT_PUBLIC_META_CONFIG_ID` | ✅ | Public — FB Login config id, safe. |
| `NEXT_PUBLIC_META_GRAPH_VERSION` | ✅ | Public, optional. |
| `META_WEBHOOK_VERIFY_TOKEN` | ✅ | GET challenge verify. Missing → 403. |
| `META_WEBHOOK_APP_SECRET` | ✅ | POST HMAC verify. Now required in production (see §2). |
| `CRON_SECRET` | ✅ | Bearer auth for Vercel cron. |
| `ENABLE_AUTOMATION_MINUTE_TESTING` | ✅ | Default unset/`false`. Opts a production deploy into minute-based automation timing (test/admin only). See §2a. |

Checks:
- **Missing envs fail safely** — ✅ Prisma/Auth throw on missing core values; all WhatsApp paths fall back to a disabled/mock provider rather than attempting a real send.
- **Public envs are safe** — ✅ Only `NEXT_PUBLIC_META_*` are exposed; all are non-secret public identifiers.
- **Secrets never in client bundles** — ✅ `META_APP_SECRET`, tokens, encryption key, webhook secret are read only in server modules / route handlers.
- **No secrets logged** — ✅ Verified in `meta-cloud-api.ts`, `provider.ts`, `resolver.ts`, `crypto.ts`, `webhook/route.ts`. The access token is only ever placed in the `Authorization` header, never in a log line or the request-payload log.
- **Note (no central validation):** there is no single env-validation module. Failures surface as framework-level errors (Prisma/Auth.js) rather than a friendly aggregated message. Acceptable for launch; an optional `env.ts` validator is a future nicety (see Pending).

---

## 2. WhatsApp / Meta production safety

**Status: PASS.** This is the strongest area of the codebase.

Verified:
- **No real send in local/test/dev** — ✅ `getWhatsAppProvider()` returns `devMockProvider` whenever `ENABLE_REAL_WHATSAPP_SEND !== "true"`. The mock logs "NOT SENT" and returns `isMockSkip`.
- **Real sends require all explicit flags** — ✅ Real path requires `ENABLE_REAL_WHATSAPP_SEND=true` **and** `WHATSAPP_PROVIDER=meta_cloud_api` **and** both `META_WHATSAPP_ACCESS_TOKEN` + `META_WHATSAPP_PHONE_NUMBER_ID`. Any missing → `createDisabledProvider()` (safe failure).
- **Per-business connection used** — ✅ All send flows go through `getWhatsAppProviderForBusiness()` / `resolveWhatsAppConnectionForBusiness()` (`src/server/whatsapp/resolver.ts`), which prefers an `active` per-business `WhatsAppConnection`.
- **`useEnvFallback=false` respected** — ✅ With `useEnvFallback=false` the resolver requires a decryptable per-business token (Mode B); it does not silently use env credentials.
- **Env fallback disabled when `WHATSAPP_USE_ENV_FALLBACK=false`** — ✅ Priority-2 env fallback only activates when the flag is `true`; otherwise an unconnected business yields the disabled provider.
- **Tokens encrypted at rest** — ✅ `crypto.ts` AES-256-GCM, versioned `v1:<iv>:<tag>:<ciphertext>`; schema stores only `accessTokenEncrypted` (no plaintext column).
- **Decrypt failures fail closed** — ✅ `tryDecryptToken()` returns `null` on any failure; resolver and readiness checks then return a disabled provider / not-ready, never a send.
- **Missing WABA / Phone Number ID / token fails safely** — ✅ Each missing field maps to a disabled provider with a safe Hebrew reason.
- **Provider logs never include tokens/secrets** — ✅ Confirmed across all provider/resolver code.
- **Webhook verify token + app secret validation** — ✅ GET verifies `hub.verify_token`; POST verifies `X-Hub-Signature-256` via timing-safe HMAC. **Hardened:** POST now **rejects (403) in production when `META_WEBHOOK_APP_SECRET` is unset** instead of processing unverified payloads (previously only warned). This closes a forged-STOP / forged-opt-out vector.
- **STOP / unsubscribe behavior** — ✅ Incoming `stop`/`unsubscribe`/`הסר`/`הסרה` sets `whatsappOptIn=false`, `marketingOptIn=false`, `unsubscribedAt`. By design this opts the phone out across all businesses (privacy-correct) and is documented in the webhook handler.
- **Test mode wrapper** — ✅ `createTestModeProvider()` blocks every recipient except `WHATSAPP_TEST_PHONE`; missing test phone → blocked, not sent.

---

## 2a. Minute-based automation timing (test/admin only)

**Status: PASS.** Production automation timing is day-based; minute mode exists only to speed up testing of Meta/WhatsApp/automation flows and never relaxes a send guard.

- **What it is** — the win-back automation can measure the inactivity threshold and cooldown in **minutes** instead of days, so a client becomes "eligible" within minutes during testing. Stored on `AutomationSetting` as `timingUnit` (`"days"` default | `"minutes"`), plus `testThresholdMinutes` / `testCooldownMinutes` (nullable, only read in minute mode).
- **Backwards compatible** — `timingUnit` defaults to `"days"`; existing rows and saves are unchanged and continue to use `thresholdDays` / `cooldownDays`. The minute columns are nullable and ignored in day mode.
- **Who may use it** — single source of truth `isMinuteTestingAllowed()` in `src/lib/automation/minute-testing.ts`. Allowed when **any** of: `NODE_ENV !== "production"` (dev/test), the caller is an **admin**, or `ENABLE_AUTOMATION_MINUTE_TESTING=true`. A regular owner in production never sees or saves minute mode unless the env flag is set.
- **UI exposure** — the "מצב בדיקה" section in the win-back settings dialog renders only when the server passes `allowMinuteTesting`. It shows the days→minutes unit toggle, a "מיועד לבדיקה בלבד" warning, an active-mode banner, and — when real sends are configured — an extra confirmation checkbox required before saving. The eligibility ("בדיקת אוטומציה") card shows "בדיקה לפי דקות פעילה" when a check ran in minute mode.
- **Cron safety (defense in depth)** — `runWinBackForBusiness` has no user context, so it gates on the environment only via `resolveTimingUnit(setting.timingUnit, isMinuteTestingAllowed())`. A setting left in `"minutes"` **falls back to days** in production unless `ENABLE_AUTOMATION_MINUTE_TESTING=true`, so the daily cron never auto-sends on minutes by accident. The save action separately gates on admin/env, so a crafted owner request cannot persist minute mode in production.
- **Guards untouched** — minute mode only shrinks the inactivity/cooldown date windows. Opt-in, marketing opt-in, unsubscribed exclusion, upcoming-booking exclusion, cooldown dedup, provider/env real-send guards, and `businessId` scoping all still apply (covered by `test/integration/automation-minute-testing.test.ts` and `winback-runner.test.ts`).

---

## 3. Public legal pages

**Status: PASS (after fix).**

- `/privacy` and `/terms` exist, render at the **root** (outside the `(app)` auth group), and are **accessible without auth** — ✅ confirmed in the build output as static (`○ /privacy`, `○ /terms`).
- Hebrew RTL — ✅ (root layout `lang="he" dir="rtl"`).
- Describe Allura as a CRM/management system for beauty businesses — ✅.
- Describe WhatsApp/Meta usage for reminders + business-approved client messages, and place consent responsibility on the business owner — ✅.
- Support email — ✅ `support@allura.info` (placeholder — replace with the real inbox before launch).
- **Legal operator placeholder** — added `Allura מופעלת על ידי [שם העסק המשפטי].` to both page footers (was missing).
- No broken internal links — ✅ (`/`, `/privacy` ↔ `/terms`, `mailto:`).
- No Beautiq leftovers on these pages — ✅.

**Not present:** `/contact` and `/about` routes do not exist. Not strictly required — both legal pages carry a support email. A standalone `/contact` page is recommended before Meta review if the app submission references one. (Not added — would be a new feature.)

---

## 4. Public customer page quality (`/b/[slug]`)

**Status: PASS.** No risks found.

- No demo/garbage text (`dfgdfg`, `ללללל`, etc.) in components or seed/demo data — ✅.
- No generic stock "office" fallback image — ✅. Missing cover/logo render brand-colored gradients with the business initial; empty gallery shows a polished Hebrew "בקרוב יעלו עבודות לגלריה".
- Polished Hebrew empty states for missing services/hours/contact/reviews — ✅ (sections return `null` or a friendly message rather than rendering broken).
- Booking CTA works (desktop sticky card `#book`; mobile smooth-scroll) — ✅.
- Mobile sticky CTA does not hide content — ✅ (`pb-28` on main vs ~70px CTA; IntersectionObserver hides it when the booking card is visible).
- No horizontal overflow — ✅ (`overflow-x-hidden` on main; reviews use a snap carousel, no fixed-width blowouts).
- Contact/social buttons render only when data exists — ✅ (phone/WhatsApp/Instagram/Facebook each gated on their field).
- Footer says "מופעל על ידי Allura" (Powered by Allura) — ✅.
- No CRM/admin controls leak onto the public page — ✅ (no session/auth hooks, no admin routes referenced; owner-facing page-builder components live in a separate folder).

---

## 5. Security and access control

**Status: PASS (1 medium, 1 low — see Risks).**

- All `(app)` owner pages require auth — ✅ `src/app/(app)/layout.tsx` calls `requireCurrentUser()` + business resolution; unauthenticated → `/login`.
- Admin area restricted to platform admins — ✅ `src/app/admin/layout.tsx` calls `requirePlatformAdmin()` (checks `user.isAdmin`); non-admins → `/dashboard`.
- **Server actions never trust client `businessId`** — ✅ Tenant is always derived from the session via `requireTenant()` / `requireCurrentBusiness()` → `BusinessUser`. Public booking derives `businessId` from the slug server-side, never from client input.
- Cross-tenant access fails closed — ✅ Business-owned queries are scoped by `businessId`; admin client updates verify ownership.
- Password hashes never selected into UI/session — ✅ `getCurrentUser()` select excludes `passwordHash`; credentials provider returns only `{id,email,name}`; session JWT carries only the user id.
- Login is non-enumerating — ✅ generic "invalid credentials" regardless of whether the email exists.
- Cron routes verify `CRON_SECRET` (Bearer) — ✅ all three. Admin automation test routes check `isAdmin` (403 otherwise) — ✅.
- Rate limiting exists on public booking, public reviews, and public slot endpoints — ✅ (in-memory limiter; see note below).

Notes:
- The rate limiter is **per-process in-memory** (`src/lib/rate-limit.ts`). On multi-instance Vercel deployments the effective limit multiplies by instance count. Acceptable for launch scale; revisit with a shared store (e.g. Upstash) if abuse appears. Documented in the code.

---

## 6. Database and Prisma

**Status: PASS.** No issues.

- Schema matches production needs; 19 sequential, single-purpose migrations; clean linear history, no hack/temp/revert migrations.
- `prisma/fix-booking-timezones.sql` is a documented **one-off** manual fix ("run exactly once"), not referenced in code and not in the managed `migrations/` folder — leave as-is.
- Every business-owned model carries `businessId` (Service, Client, Booking, Payment, Expense, AvailabilityRule/Exception, MessageTemplate, AutomationSetting/Run/Message, WaitlistEntry, Recommendation, Reminder, ClientReview, GalleryImage, WhatsAppConnection, BusinessSubscription, CancellationPolicy).
- Tenant-scoped uniqueness is correct: `Client @@unique([businessId, normalizedPhone])`, `MessageTemplate`/`AutomationSetting @@unique([businessId, type])`, `AvailabilityException @@unique([businessId, date])`; `Business.slug` is globally unique (correct); `WhatsAppConnection.businessId` is `@unique` (one connection per business).
- Relationship cascades are sound (Booking → Business/Client/Service cascade; reschedule self-relation `SetNull`; `AutomationMessage.bookingId` `SetNull`).
- `WhatsAppConnection` stores only `accessTokenEncrypted` (no plaintext token), plus status/phone/waba/webhook-timestamp/`lastError` fields.
- No core entities stored in JSON; JSON used only for `Business.settings` and `Recommendation.dataSnapshot`.

---

## 7. Build / deploy readiness

**Status: PASS (after fixing a masked typecheck failure).**

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0, 0 warnings |
| `npm test` | ✅ 727 passed / 72 files |
| `npm run build` | ✅ exit 0 |

- **Masked gate failure found & fixed:** from a cold TypeScript cache, `tsc --noEmit` failed with 3 errors in untracked test file `test/unit/lib/whatsapp-meta-onboarding.test.ts` (empty-tuple indexing on `vi.fn` mock calls). `next build` passes because it does **not** type-check test files, so CI relying only on `build` would have stayed green while `typecheck` was red. Fixed the test (cast mock-call indexing) — see Fixes.
- `vercel.json` build command runs `prisma generate && prisma migrate deploy && next build` — correct for Vercel. Three hourly crons registered (win-back, morning-reminder, review-request), each `CRON_SECRET`-guarded.
- Console logging in production paths is intentional and **token-free** (provider/webhook diagnostics). No noisy `console.log` leaking secrets.
- `npm audit` is not wired into the gate; no action taken (out of scope for this pass).

---

## 8. Product scope check

**Status: PASS for navigation; minor cross-link notes.**

Navigation (`src/components/layout/nav-items.ts`) exposes **only** in-scope pages: Dashboard, Bookings, Clients, Services, Availability, Public Page, Bring Back, Automations, Finance, Settings. **None** of the deprioritized pages (הודעות, שימור לקוחות, מוניטין, תובנות מחיר, לקוחות בסיכון, קמפיינים, תחזית, חלונות פנויים) appear in the sidebar/menu. ✅

The deprioritized route folders still exist and still function (fine — they're just not in nav). However a few **secondary** links still point at them (not navigation, not changed in this pass to avoid altering product behavior):
- `src/lib/guidance/rules.ts` — dashboard guidance cards link to `/retention`, `/reputation`, `/pricing`.
- `src/components/bookings/booking-row-actions.tsx` — links to `/messages`.
- `src/components/reputation/client-reputation-card.tsx` — links to `/reputation`.

These are working pages, so the links are not broken and pose no production risk. Decide before launch whether to also remove these secondary entry points (left as a product decision — see Pending).

---

## 9. Residual scope cleanup (2026-06-15, follow-up pass)

A safe, product-scope cleanup pass (no feature changes, no folder deletions) to make sure nothing off-scope is reachable from current flows before launch.

**Done in this pass:**
- **`/at-risk` link removed** — `recommendations.atRiskHref` in `src/lib/constants/he.ts` was `"/at-risk"` (consumed by the off-nav `/revenue-forecast` page). Re-pointed to the in-scope `"/bring-back"` page; the action label ("צפייה בלקוחות בסיכון") still fits client win-back. No live `/at-risk` href remains.
- **Branding scrub (non-user-facing)** — `Beautiq` → `Allura` in `CLAUDE.md`, `prisma/schema.prisma` header comment, `docker-compose.yml` header, and the README project-structure line. The local Postgres identifiers (`beautiq_user` / `beautiq_password` / `beautiq_dev` / container `beautiq-postgres` / volume `beautiq_postgres_data`) are **kept intentionally** — renaming them would orphan existing dev volumes and break local `DATABASE_URL`s. A comment in `docker-compose.yml` marks them as legacy local-only identifiers, unrelated to the brand.
- **Stale demo credential fixed** — README listed the demo login as `demo@beautiq.local`, but `prisma/demo.ts` seeds `demo@allura.local`; the README would have given a failing login. Corrected to `demo@allura.local`.
- **Domain/email placeholders** — confirmed a single canonical placeholder is used everywhere via `src/lib/config.ts` (`APP_URL` / `SUPPORT_EMAIL`, overridable with `NEXT_PUBLIC_APP_URL`). No scattered `allura.app` / `allura.co` variants remain in `src/`, `test/`, or `.env.example`.
- **Legal operator placeholder** — `Allura מופעלת על ידי [שם העסק המשפטי].` confirmed present and identical on both `/privacy` and `/terms`. (`/contact` does not exist, so nothing to update there.)

### Deprioritized route folders — pre-launch decision still open

The following route folders are **hidden / off-nav** but remain **technically routable for an authenticated owner** who navigates directly to the URL (they are not in `nav-items.ts` and are not public):

- `/messages`
- `/retention`
- `/reputation`
- `/pricing`
- `/at-risk`
- `/empty-slots`
- `/revenue-forecast`
- `/win-back-campaigns`

Current safe state (this pass):
- **No visible links from current navigation or current flows** — the sidebar excludes them; the previously-flagged secondary links (guidance cards → `/retention` `/reputation` `/pricing`, booking row → `/messages`, reputation card → `/reputation`) are gone from the current code; the last `/at-risk` link is re-pointed to `/bring-back`.
- **No public/customer access** — all live under the authenticated `(app)` group; none are reachable from `/b/[slug]` or any public page.
- **No broken routes** — folders are left intact and still compile/render, so a direct hit returns the page rather than a 404 or error.
- One **internal** residual link remains by design: `recommendations.winBackHref` → `/win-back-campaigns`, but it is rendered **only** inside the off-nav `/revenue-forecast` page, so it is not reachable from any current flow.

Decision to make before launch (not taken here — folder deletion was explicitly out of scope for this pass):
- **A.** Delete the route folders completely.
- **B.** Redirect them to current-scope pages (e.g. `/bring-back`, `/clients`, `/finance`).
- **C.** Keep them as hidden legacy routes temporarily.

Until that decision is made, the safest current behavior above is in place: off-nav, non-public, non-broken, with no current-flow entry points.

---

## Risks found

| # | Severity | Area | Risk | Status |
|---|---|---|---|---|
| 1 | **Medium** | Build gate | `npm run typecheck` failed from cold cache (3 errors in untracked test file); masked by `next build` not type-checking tests. | **Fixed** |
| 2 | **Medium** | Branding | Customer-facing review messages defaulted to `beautiq.co/...` (old brand) when no custom review link set. | **Fixed** → canonical `allura.info/...` (see #7) |
| 3 | **Low** | WhatsApp webhook | In production, missing `META_WEBHOOK_APP_SECRET` previously processed unverified POSTs (forged STOP/opt-out vector). | **Fixed** → fails closed (403) in production |
| 4 | **Low** | Branding | `Beautiq` leftovers in README title and `.env.example` example domain. | **Fixed** |
| 5 | **Low** | Admin errors | Admin automation routes return `String(err)` in JSON. | **Accepted** (admin-only, behind `isAdmin`; useful for diagnostics). Noted, not changed. |
| 6 | **Low** | Rate limiting | In-memory limiter is per-instance; weaker across multiple Vercel instances. | **Accepted** for launch scale; revisit with shared store. |
| 7 | **Info** | Branding | Placeholder public domains were inconsistent across the code (`allura.app`, `allura.co`, `allura.co.il`, `allura.info`). | **Fixed** → single canonical `https://allura.info`, centralized in `src/lib/config.ts` with `NEXT_PUBLIC_APP_URL` override. |

No high-severity risks found.

---

## Fixes made

1. **Legal operator placeholder** — added `Allura מופעלת על ידי [שם העסק המשפטי].` to the footers of `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`.
2. **Old-brand review link** — `beautiq.co/...` → canonical `allura.info/...` (via `src/lib/config.ts`, see #7) in `src/server/review-request/runner.ts` (default review link sent to clients) and `src/components/automations/review-request-card.tsx` (preview placeholder).
3. **Webhook fails closed in production** — `src/app/api/whatsapp/webhook/route.ts` now returns 403 for unsigned POSTs when `META_WEBHOOK_APP_SECRET` is unset and `NODE_ENV=production` (still skips with a warning in non-production for local testing).
4. **Typecheck gate fix** — `test/unit/lib/whatsapp-meta-onboarding.test.ts`: cast empty-tuple mock-call indexing and dropped an unused mock param so `tsc --noEmit` and `lint` are clean.
5. **Branding hygiene (docs only)** — README title `Beautiq` → `Allura`; `.env.example` `AUTH_URL` example `app.beautiq.co.il` → `app.allura.info`.
6. **Lint config** — added `coverage/**` to ESLint global ignores (removed a stray warning from a generated file).
7. **Canonical public domain** — introduced `src/lib/config.ts` (`APP_URL`, `APP_DOMAIN`, `SUPPORT_EMAIL`, `publicBusinessUrl()`), defaulting to `https://allura.info` and overridable via `NEXT_PUBLIC_APP_URL`. Replaced the scattered `allura.app` / `allura.co` / `allura.co.il` placeholders in `review-request/runner.ts`, `win-back-automation/actions.ts`, `whatsapp/default-templates.ts`, `auth-shell.tsx`, `review-request-card.tsx`, and `win-back-automation-card.tsx`; centralized `SUPPORT_EMAIL` in both legal pages; documented `NEXT_PUBLIC_APP_URL` in `.env.example`.

No product behavior was changed beyond the production-safety fix (#3) and the customer-facing brand correction (#2).

---

## Things still pending before enabling real WhatsApp sending

1. **Meta approval** — complete Meta Business Verification + WhatsApp/Embedded-Signup app review (the reason real send is gated).
2. **Set production env (see checklist below)** — in particular flip the guards and provide real credentials/secrets.
3. **Canonical public domain** — ✅ done: all links resolve through `src/lib/config.ts` (`https://allura.info` by default, `NEXT_PUBLIC_APP_URL` to override in prod). Set `NEXT_PUBLIC_APP_URL` if the final launch domain differs.
4. **Replace `support@allura.info`** with the real monitored support inbox (now centralized in `src/lib/config.ts` → `SUPPORT_EMAIL`), and fill `[שם העסק המשפטי]` with the real legal operator name on both legal pages.
5. **Approved Hebrew message templates** — every automation needs a Meta-approved `templateName`; real-send mode refuses to send without one (already enforced).
6. **Webhook registration** — register `https://<domain>/api/whatsapp/webhook` in the Meta dashboard with the matching `META_WEBHOOK_VERIFY_TOKEN`, and confirm `META_WEBHOOK_APP_SECRET` is set (now required in prod).
7. **Staged rollout** — keep `WHATSAPP_TEST_MODE=true` with a single `WHATSAPP_TEST_PHONE` for the first live verification, then flip to `false` only after confirming end-to-end delivery.
8. **(Optional) `/contact` page** if the Meta app submission references one.
9. **(Optional) Shared rate-limit store** before any significant public traffic.

---

## Exact env checklist for Vercel (production)

Core (required):
```
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db>?schema=public&sslmode=require
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://<your-production-domain>
CRON_SECRET=<openssl rand -hex 32>
```

WhatsApp — keep DISABLED until Meta approval (safe default):
```
ENABLE_REAL_WHATSAPP_SEND=false        # ← keep false until go-live
WHATSAPP_PROVIDER=meta_cloud_api
WHATSAPP_TEST_MODE=true                # ← keep true for first live tests
WHATSAPP_TEST_PHONE=+9725XXXXXXXX
WHATSAPP_USE_ENV_FALLBACK=false        # ← per-business connections in prod
```

WhatsApp — credentials & encryption (set now; used once enabled):
```
WHATSAPP_CREDENTIALS_ENCRYPTION_KEY=<openssl rand -hex 32>   # required in prod
META_APP_ID=<meta app id>
META_APP_SECRET=<meta app secret>
NEXT_PUBLIC_META_APP_ID=<same meta app id>
NEXT_PUBLIC_META_CONFIG_ID=<facebook login config id>
# NEXT_PUBLIC_META_GRAPH_VERSION=v19.0   # optional
```

WhatsApp — webhook (required in prod; POST now fails closed without the secret):
```
META_WEBHOOK_VERIFY_TOKEN=<openssl rand -hex 16>
META_WEBHOOK_APP_SECRET=<meta app secret from dashboard>
```

WhatsApp — env-fallback credentials (only if you ever set `WHATSAPP_USE_ENV_FALLBACK=true` for a pilot; not needed for per-business prod):
```
META_WHATSAPP_ACCESS_TOKEN=<system user token>
META_WHATSAPP_PHONE_NUMBER_ID=<phone number id>
# META_WHATSAPP_WABA_ID=<waba id>          # optional
# META_WHATSAPP_API_VERSION=v19.0          # optional
```

**Go-live flip (only after Meta approval + verified test send):**
```
ENABLE_REAL_WHATSAPP_SEND=true
WHATSAPP_TEST_MODE=false
```
</content>
</invoke>
