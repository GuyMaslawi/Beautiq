/**
 * Payment provider webhook endpoint.
 *
 *   POST /api/payments/[provider]/webhook
 *
 * Confirmation of payment comes ONLY from here (a verified provider event) —
 * never from a client-side success redirect. The flow is:
 *   1. read the raw body (needed for signature verification),
 *   2. select the provider adapter by the URL kind,
 *   3. verify the signature (fail closed),
 *   4. parse into a normalized event,
 *   5. apply idempotently (keyed on providerTransactionId).
 *
 * Tenant scoping: BookingPayment.providerTransactionId is globally unique, so
 * locating the record by it inherently scopes to the owning business.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { PaymentProviderKind } from "@prisma/client";
import { mockProvider, type PaymentProvider } from "@/lib/payments/provider";
import { applyPaymentWebhookEvent } from "@/server/payments/booking-payment";

function providerForKind(kind: string): PaymentProvider | null {
  // Only the mock provider has a wired webhook adapter so far. PayPlus / Grow /
  // Tranzila are the documented next providers (see docs/payments.md).
  if (kind === "mock") return mockProvider;
  return null;
}

function headerMap(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: kind } = await params;
  const rawBody = await req.text();
  const headers = headerMap(req);

  const provider = providerForKind(kind);
  if (!provider) {
    // Real provider webhook not yet implemented — acknowledge so the provider
    // does not enter a retry storm, but log for visibility.
    console.warn(
      `[payments webhook] unsupported provider="${kind}" — no adapter wired`,
    );
    return new NextResponse("OK", { status: 200 });
  }

  // Per-business webhook signing secret. For real providers, fail closed in
  // production when it is missing.
  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? null;
  const isRealKind =
    (kind as PaymentProviderKind) !== "mock" &&
    (kind as PaymentProviderKind) !== "disabled";
  if (isRealKind && !secret && process.env.NODE_ENV === "production") {
    console.error(
      `[payments webhook] PAYMENT_WEBHOOK_SECRET missing for real provider="${kind}" — rejecting`,
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!provider.verifyWebhook({ rawBody, headers, secret })) {
    console.warn(`[payments webhook] signature verification failed (provider=${kind})`);
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const event = provider.parseWebhook({ rawBody, headers, secret });
  if (!event) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    await applyPaymentWebhookEvent(event);
  } catch (err) {
    console.error("[payments webhook] apply failed:", err);
    // 500 lets the provider retry; idempotency makes that safe.
    return new NextResponse("Error", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
