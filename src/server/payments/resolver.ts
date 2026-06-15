/**
 * Per-business payment provider resolver.
 *
 * Decides which PaymentProvider to use for a given business and whether real
 * money can move. Mirrors the WhatsApp resolver: real providers require BOTH
 * env-level gating (isRealPaymentsConfigured) AND an active per-business
 * connection with the needed credentials. Otherwise we fall back to the safe
 * mock provider.
 *
 * Tests never set the gating env vars, so this always resolves to the mock
 * provider in tests — no real network calls are possible.
 *
 * Server-only.
 */

import type { PaymentProviderKind } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  mockProvider,
  createDisabledProvider,
  isRealPaymentsConfigured,
  type PaymentProvider,
} from "@/lib/payments/provider";
import { tryDecryptCredentials } from "@/lib/payments/crypto";

export interface ResolvedPaymentProvider {
  provider: PaymentProvider;
  /** True only when a real, money-moving provider is fully wired. */
  isReal: boolean;
  /** The configured provider on the business settings (may differ if disabled). */
  configuredProvider: PaymentProviderKind;
  /** Short owner-facing status string. */
  status: "mock" | "active" | "not_connected" | "error";
  statusDetail?: string;
}

/**
 * Resolve the provider for a business. `settingsProvider` is the provider the
 * owner selected in BusinessPaymentSettings.
 */
export async function resolvePaymentProviderForBusiness(
  businessId: string,
): Promise<ResolvedPaymentProvider> {
  const settings = await prisma.businessPaymentSettings.findUnique({
    where: { businessId },
    select: { provider: true },
  });
  const configuredProvider = settings?.provider ?? "mock";

  // mock / disabled → always the safe mock provider, regardless of env.
  if (configuredProvider === "mock" || configuredProvider === "disabled") {
    return {
      provider: mockProvider,
      isReal: false,
      configuredProvider,
      status: "mock",
      statusDetail: "מצב בדיקה — לא מתבצעת סליקה אמיתית",
    };
  }

  // Real provider selected. Outer env gate must allow real payments.
  if (!isRealPaymentsConfigured()) {
    return {
      provider: mockProvider,
      isReal: false,
      configuredProvider,
      status: "mock",
      statusDetail: "סליקה אמיתית מושבתת בסביבה זו — מצב בדיקה",
    };
  }

  // Per-business connection must be active with credentials present.
  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { businessId },
  });

  if (!connection || connection.status !== "active") {
    return {
      provider: createDisabledProvider(
        configuredProvider,
        "no active provider connection",
      ),
      isReal: false,
      configuredProvider,
      status: "not_connected",
      statusDetail: "ספק הסליקה לא מחובר",
    };
  }

  const creds = tryDecryptCredentials(connection.credentialsEncrypted);
  if (!creds) {
    return {
      provider: createDisabledProvider(
        configuredProvider,
        "missing or undecryptable credentials",
      ),
      isReal: false,
      configuredProvider,
      status: "error",
      statusDetail: "בעיה בפענוח פרטי הסליקה",
    };
  }

  // NOTE: PayPlus / Grow-Meshulam / Tranzila are the documented next
  // providers. Until their hosted-link adapters are implemented, a real
  // provider that is "connected" still fails closed rather than guessing.
  return {
    provider: createDisabledProvider(
      configuredProvider,
      `provider "${configuredProvider}" adapter not yet implemented`,
    ),
    isReal: false,
    configuredProvider,
    status: "error",
    statusDetail: "ספק הסליקה עדיין אינו נתמך באופן מלא",
  };
}
