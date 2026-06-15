/**
 * Payment provider abstraction.
 *
 * A provider knows how to create a HOSTED payment link, read a payment's
 * status, and verify + parse provider webhooks. Allura never collects card
 * details itself — the customer always pays on the provider's secure page.
 *
 * The only real-money provider wired in this pass is the safe `mock` provider
 * (dev/test). PayPlus / Grow-Meshulam / Tranzila are documented as the next
 * providers and currently resolve to a disabled provider that fails closed.
 *
 * Server-only.
 */

import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import type { PaymentProviderKind } from "@prisma/client";

export interface CreatePaymentLinkInput {
  businessId: string;
  bookingPaymentId: string;
  amountMinor: number;
  currency: string; // "ILS"
  description: string;
  customerName: string;
  customerPhone: string;
  /** Where the provider returns the customer on success / failure / cancel. */
  returnSuccessUrl: string;
  returnFailureUrl: string;
  /** Server-to-server callback URL the provider should POST to. */
  webhookUrl: string;
}

export interface CreatePaymentLinkResult {
  paymentUrl: string;
  providerTransactionId: string;
  expiresAt?: Date | null;
  /** Sanitized provider metadata — never contains secrets or PAN. */
  metadata?: Record<string, unknown>;
}

export type ProviderPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export interface PaymentStatusResult {
  providerTransactionId: string;
  status: ProviderPaymentStatus;
  paidAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface WebhookInput {
  rawBody: string;
  headers: Record<string, string | null | undefined>;
  /** Per-business webhook signing secret, if configured. */
  secret?: string | null;
}

export interface ParsedWebhookEvent {
  providerTransactionId: string;
  /** Normalized terminal status reported by the provider. */
  status: "paid" | "failed" | "cancelled" | "expired";
  amountMinor?: number;
  paidAt?: Date | null;
  /** Sanitized raw payload (no secrets / PAN) for audit. */
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: PaymentProviderKind;
  /** Whether this provider can move real money. The mock provider is false. */
  readonly isReal: boolean;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult>;
  getPaymentStatus(providerTransactionId: string): Promise<PaymentStatusResult>;
  /** Verify a webhook is authentic. Fail closed: return false when unsure. */
  verifyWebhook(input: WebhookInput): boolean;
  /** Parse a verified webhook body into a normalized event, or null if irrelevant. */
  parseWebhook(input: WebhookInput): ParsedWebhookEvent | null;
}

// ---------------------------------------------------------------------------
// Mock provider — safe dev/test default. Never moves real money.
// ---------------------------------------------------------------------------

/**
 * The mock provider points the customer at an in-app "hosted page"
 * (/pay/mock/[id]) that simulates the provider's secure checkout. That page
 * drives the same webhook the real providers would, so the whole flow can be
 * exercised end to end in dev without any external service.
 */
function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  isReal: false,

  async createPaymentLink(input) {
    const providerTransactionId = `mock_${randomUUID()}`;
    const url = new URL(`${appBaseUrl()}/pay/mock/${input.bookingPaymentId}`);
    url.searchParams.set("txn", providerTransactionId);
    return {
      paymentUrl: url.toString(),
      providerTransactionId,
      expiresAt: null,
      metadata: { mock: true, amountMinor: input.amountMinor },
    };
  },

  async getPaymentStatus(providerTransactionId) {
    // The mock provider is stateless — status is driven by the webhook the
    // mock checkout page fires. Callers rely on the DB record, not this.
    return { providerTransactionId, status: "pending" };
  },

  verifyWebhook(input) {
    // In the mock provider we accept a simple shared-secret header when a
    // secret is configured; otherwise (pure dev) we accept unsigned calls.
    if (!input.secret) return true;
    const sig = input.headers["x-mock-signature"] ?? "";
    const expected = createHmac("sha256", input.secret)
      .update(input.rawBody)
      .digest("hex");
    try {
      return timingSafeEqual(Buffer.from(String(sig)), Buffer.from(expected));
    } catch {
      return false;
    }
  },

  parseWebhook(input) {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
    const providerTransactionId = String(body.txn ?? body.providerTransactionId ?? "");
    const rawStatus = String(body.status ?? "");
    if (!providerTransactionId) return null;

    const status: ParsedWebhookEvent["status"] =
      rawStatus === "paid"
        ? "paid"
        : rawStatus === "cancelled"
          ? "cancelled"
          : rawStatus === "expired"
            ? "expired"
            : "failed";

    return {
      providerTransactionId,
      status,
      amountMinor:
        typeof body.amountMinor === "number" ? body.amountMinor : undefined,
      paidAt: status === "paid" ? new Date() : null,
      raw: { mock: true, status: rawStatus },
    };
  },
};

// ---------------------------------------------------------------------------
// Disabled provider — fails closed. Used when a real provider is selected but
// not yet implemented / not properly configured.
// ---------------------------------------------------------------------------

export function createDisabledProvider(
  name: PaymentProviderKind,
  reason: string,
): PaymentProvider {
  return {
    name,
    isReal: false,
    async createPaymentLink() {
      throw new Error(`Payment provider unavailable: ${reason}`);
    },
    async getPaymentStatus(providerTransactionId) {
      return { providerTransactionId, status: "failed" };
    },
    verifyWebhook() {
      return false;
    },
    parseWebhook() {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Env-level gating
// ---------------------------------------------------------------------------

/**
 * Whether real (money-moving) payments are globally enabled by environment.
 * This is the OUTER gate; a business must ALSO have an active provider
 * connection (checked in the resolver). Tests never set these, so they always
 * resolve to the mock provider and never hit a real network.
 */
export function isRealPaymentsConfigured(): boolean {
  return (
    process.env.PAYMENTS_ENABLED === "true" &&
    !!process.env.PAYMENT_PROVIDER &&
    process.env.PAYMENT_PROVIDER !== "mock" &&
    process.env.PAYMENT_PROVIDER !== "disabled"
  );
}
