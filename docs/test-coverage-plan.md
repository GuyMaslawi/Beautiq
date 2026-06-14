# Allura — Test Coverage Plan

Status: **complete for this pass.** 632 tests across 64 files, all green.
`npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all pass.
This document tracks the stability/coverage pass added while waiting for Meta
Business Verification. No product features were added — tests only, plus minimal
test infrastructure (Vitest + factories + a deep-mocked Prisma client).

Gate status: ✅ lint (0/0) · ✅ typecheck (0 errors) · ✅ tests (632/632) · ✅ build

## Test stack

- **Vitest 3** — runner + assertions + mocking (ESM-native, fits Next 16 / React 19).
- **@testing-library/react + jsdom** — component tests (opt-in per file via
  `// @vitest-environment jsdom`). Default environment is `node`.
- **vite-tsconfig-paths** — wires the `@/*` alias so tests import like app code.

Commands:

```
npm test            # vitest run (all)
npm run test:watch  # vitest watch
npm run test:coverage
```

There is **no test database**. DB-backed server actions/queries are tested with a
**deep-mocked Prisma client** (`test/helpers/prisma-mock.ts`). This keeps the
suite fast and hermetic, and lets us assert the thing that matters most for a
multi-tenant SaaS: **every business-owned query carries the correct `businessId`.**

## Conventions (read before adding tests)

- Pure logic / libs → `test/unit/**` (node env, no mocks).
- Server actions / queries → `test/integration/**` (mocked Prisma).
- React components → `test/component/**` with `// @vitest-environment jsdom`.
- Use factories from `test/helpers/factories.ts` (`BUSINESS_A`, `BUSINESS_B`).
- **Never** hit the network or trigger a real WhatsApp send. `test/setup.ts`
  force-clears all real-send env vars before every test.

### Mocked-Prisma boilerplate

```ts
vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof import("../helpers/prisma-mock").createPrismaMock
>;
// In beforeEach: resetPrismaMock(prisma)
```

Also mock, as needed: `next/cache` (`revalidatePath`), `next/headers`
(`headers`), `next/navigation` (`redirect` — throws in app code), and the
in-memory `@/lib/rate-limit` (module-global state leaks across tests).

## Coverage map

Legend: ✅ covered · 🟡 partial · ⬜ not yet · 🚫 not unit-testable

### Pure libraries (`test/unit`)
- ✅ `lib/phone` — normalization + validation, idempotency, cross-format key stability
- ✅ `lib/time` — minutes↔HH:MM, Israel DST (summer/winter) UTC conversion
- ✅ `lib/slug` — slugify (Hebrew→empty), validation, boundaries
- ✅ `lib/cancellation` — late-window detection, fixed/percentage fee
- ✅ `lib/rate-limit` — window, reset, per-key isolation, IP extraction
- ✅ `lib/whatsapp/crypto` — AES-GCM round-trip, tamper/key-mismatch/missing-key safety, no plaintext leak
- ✅ `lib/whatsapp/provider` — full env-guard matrix, dev-mock never sends, test-mode phone gating
- ✅ `lib/validation/*` — public-booking, booking, service, availability (weekly + exception)
- ✅ `lib/messages/render-template` — variable substitution, Hebrew fallback, unknown placeholders

### Server actions / queries (`test/integration`)
- ✅ `public-booking/actions` — slug-derived businessId (no client trust), cross-tenant service rejection, past/overlap/rate-limit, review clamp
- ✅ services (actions + queries) — scoping, form-injected businessId ignored, validation short-circuit, isActive
- ✅ clients (actions/queries/stats/find-or-create/import/whatsapp-actions) — dedup by normalizedPhone, opt-in fields, cross-tenant rejection
- ✅ bookings (actions + queries) — all status transitions guarded + scoped, hasOverlap/getBooking scoped, create endTime math
- ✅ availability (actions + queries + get-available-slots) — weekly rules, exceptions, slot generation edge cases
- ✅ finance, deposits, dashboard, settings, business — every aggregate/write businessId-scoped, validation, profit math
- ✅ auth (session/actions/password) + admin gate — passwordHash never selected, require* redirects, hashed-password persistence
- ✅ whatsapp resolver/owner-status/templates/embedded-signup — full mode matrix, decrypt-failure safety, token never leaked
- ✅ meta-cloud-api / templates-api / onboarding — `fetch` mocked, payload shape, safe failure reasons, token header-only
- ✅ webhook route — GET verify challenge, POST signature/status/STOP opt-out
- ✅ cron routes (morning-reminder / win-back / review-request) — fail-closed auth guard, runner mocked
- ✅ win-back eligibility/breakdown/blocked-clients/runner/manual-run — query-shape + scoping + **no-real-send guarantee**
- ✅ automations queries/retry + morning-reminder/review-request runners — run/message audit, idempotency, skip guards
- ✅ public-page/queries — businessId-scoped, public-safe fields only (no passwordHash/token/internal fields)

### Components (`test/component`, jsdom)
- ✅ `booking-request-form` — service list, disabled→enabled CTA, step progression, deposit notice, RTL, no null leakage
- ✅ public page sections — gallery empty state, reviews safe layout + cap, conditional contact/social, "Powered by Allura" footer
- ✅ sticky CTA — IntersectionObserver visibility, scroll/focus to `#book`, missing-anchor no-crash

## Observations (not bugs — no source changed)
- `updateClientOptInAction` / `updateClientAction` use `findUnique({ where: { id } })`
  followed by a manual `businessId !== tenant.businessId` reject, rather than the
  `updateMany`-scoped pattern used elsewhere. Still safe (the check blocks
  cross-tenant writes before any mutation), but inconsistent with CLAUDE.md §10's
  "never fetch by id alone" preference. Candidate for a future consistency pass.
- The WhatsApp webhook `STOP`/`הסר` handler opts a phone out across **all**
  businesses by design (documented in the route). Intentional, covered by tests.
- `meta-cloud-api` logs the request payload (recipient phone, template vars) but
  never the access token (token is `Authorization` header-only). Acceptable.

## What cannot be fully covered (and why)
- **Real Meta/WhatsApp delivery** — network calls are mocked; we test only the
  send *decision* logic and guards. End-to-end delivery requires Meta approval.
- **Full Next.js server-component page rendering** — `page.tsx` server components
  fetch via Prisma + `auth()` in the framework runtime; covered at the
  query/action layer instead of full render.
- **next-auth session wiring** — `auth()` is exercised via mocked session; the
  real OAuth/credentials handshake is framework-owned.
- **Postgres-level constraints** (unique `[businessId, normalizedPhone]`, indexes)
  — enforced by the DB, asserted indirectly via the dedup code path.
