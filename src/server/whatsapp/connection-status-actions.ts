"use server";

/**
 * Owner-facing WhatsApp connection status reader.
 *
 * Used by the connection card to refetch the live connection state after the
 * Meta Embedded Signup popup closes — so the UI updates without a manual page
 * refresh. This is a READ-ONLY, business-scoped view.
 *
 * SAFETY: returns only owner/admin-safe fields. It NEVER returns the access
 * token, encrypted credentials, app secret, WABA id, or phone number id. The
 * lastError stored on the connection is already token-scrubbed at write time
 * (see scrubToken in embedded-signup-actions / meta-onboarding).
 */

import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getWhatsAppReadiness } from "@/server/whatsapp/resolver";

export interface WhatsAppConnectionStatusView {
  /** True only when the business can send real production WhatsApp messages. */
  connected: boolean;
  /** Machine-readable state used to drive the card. */
  state: "not_connected" | "pending" | "active" | "error";
  /** Owner-facing Hebrew label. */
  statusLabel: string;
  /** The business's own display phone (never an internal id). */
  displayPhoneNumber?: string;
  /** Safe provider name (e.g. "meta_cloud"). */
  provider?: string;
  /** Raw connection status column (admin diagnostics). */
  status?: string;
  /** ISO timestamp of the last successful verification. */
  lastVerifiedAt?: string;
  /** Token-scrubbed error message (admin diagnostics). */
  lastError?: string;
}

/**
 * Read the current WhatsApp connection status for the authenticated business.
 * Always scoped to the current business — never reads by raw record id.
 */
export async function getWhatsAppConnectionStatusAction(): Promise<WhatsAppConnectionStatusView> {
  const business = await requireCurrentBusiness();

  const [readiness, connection] = await Promise.all([
    getWhatsAppReadiness(business.id),
    prisma.whatsAppConnection.findUnique({
      where: { businessId: business.id },
      // Only safe columns — NEVER select accessTokenEncrypted / wabaId / phoneNumberId here.
      select: {
        provider: true,
        status: true,
        lastVerifiedAt: true,
        lastError: true,
      },
    }),
  ]);

  return {
    connected: readiness.state === "active",
    state: readiness.state,
    statusLabel: readiness.statusLabel,
    displayPhoneNumber: readiness.displayPhoneNumber,
    provider: connection?.provider ?? undefined,
    status: connection?.status ?? undefined,
    lastVerifiedAt: connection?.lastVerifiedAt?.toISOString() ?? undefined,
    lastError: connection?.lastError ?? undefined,
  };
}
