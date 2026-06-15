import { vi } from "vitest";

/**
 * Deep-mocked Prisma client for integration-style tests of server actions and
 * queries without a real database.
 *
 * Every model exposes the common delegate methods as vi.fn(). Tests set return
 * values per-case (e.g. `prismaMock.service.findFirst.mockResolvedValue(...)`)
 * and assert on the arguments — crucially that every business-owned query
 * carries the correct `businessId` (multi-tenant scoping, CLAUDE.md §10).
 *
 * Usage (must be hoisted — vi.mock is hoisted to the top of the file):
 *
 *   vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));
 *
 * Because vi.mock is hoisted above imports, import prismaMock via the
 * `vi.hoisted` pattern or simply reference this shared singleton.
 */

const MODELS = [
  "user",
  "businessCategory",
  "business",
  "businessUser",
  "businessCategoryOnBusiness",
  "service",
  "client",
  "booking",
  "availabilityRule",
  "availabilityException",
  "payment",
  "cancellationPolicy",
  "systemMessageTemplate",
  "messageTemplate",
  "reminder",
  "waitlistEntry",
  "galleryImage",
  "clientReview",
  "recommendation",
  "expense",
  "businessSubscription",
  "whatsAppConnection",
  "automationSetting",
  "automationRun",
  "automationMessage",
  "businessPaymentSettings",
  "paymentProviderConnection",
  "bookingPayment",
] as const;

const DELEGATE_METHODS = [
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
] as const;

export type PrismaMock = ReturnType<typeof createPrismaMock>;

export function createPrismaMock() {
  const mock = {} as Record<string, Record<string, ReturnType<typeof vi.fn>>> & {
    $transaction: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
  };

  for (const model of MODELS) {
    mock[model] = {};
    for (const method of DELEGATE_METHODS) {
      mock[model][method] = vi.fn();
    }
  }

  // $transaction: support both array form and callback form.
  mock.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => unknown)(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return undefined;
  });
  mock.$queryRaw = vi.fn();
  mock.$executeRaw = vi.fn();

  return mock;
}

/** Reset all delegate mocks (call in beforeEach when reusing a singleton). */
export function resetPrismaMock(mock: PrismaMock) {
  for (const model of MODELS) {
    for (const method of DELEGATE_METHODS) {
      mock[model][method].mockReset();
    }
  }
  mock.$transaction.mockClear();
  mock.$queryRaw.mockReset();
  mock.$executeRaw.mockReset();
}
