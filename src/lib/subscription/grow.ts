/**
 * Grow (Meshulam) subscription adapter — brokered through Make (Integromat).
 *
 * The owner pays Allura for their monthly plan on Grow's SECURE hosted page as a
 * recurring direct debit (הוראת קבע). We do NOT call Grow's API directly and hold
 * NO Grow credentials — a free Make scenario owns the Grow connection. The flow:
 *
 *   1. createPaymentLink(): our server POSTs the order to a Make "Custom webhook";
 *      the Make scenario calls Grow "Create Payment Link" (recurring) and returns
 *      { url, processId, processToken } synchronously via a Webhook-Response module.
 *   2. The owner pays on Grow's page and is returned to our successUrl.
 *   3. Grow POSTs a server-to-server notification directly to our notifyUrl
 *      (`/api/subscription/webhook`) — the SOURCE OF TRUTH — which we verify and
 *      then activate the plan. Confirmation NEVER comes from the browser redirect.
 *   4. Grow charges the direct debit automatically every month and re-notifies our
 *      webhook each cycle (no renewal cron on our side).
 *
 * Grow API reference: https://developers.grow.business/reference
 * Make app guide:     https://developers.grow.business/docs/grow-app-for-make
 *
 * Server-only — never import from a client component.
 */

// ---------------------------------------------------------------------------
// Configuration & env gating
// ---------------------------------------------------------------------------

function env(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * True when real Grow billing is fully configured. Requires the outer feature
 * flag AND the Make create-link webhook URL. Tests / dev never set these, so the
 * subscription flow falls back to a safe dev activation and no network call is made.
 */
export function isGrowConfigured(): boolean {
  return (
    (process.env.SUBSCRIPTIONS_ENABLED ?? "").trim().toLowerCase() === "true" &&
    !!env("MAKE_GROW_CREATE_LINK_WEBHOOK_URL")
  );
}

// ---------------------------------------------------------------------------
// createPaymentLink — ask the Make scenario to build a Grow payment page
// ---------------------------------------------------------------------------

export interface CreateLinkInput {
  /** Amount in agorot (₪1 = 100). Sent to Make in shekels. */
  amountMinor: number;
  description: string;
  fullName: string;
  phone: string;
  email?: string;
  successUrl: string;
  notifyUrl: string;
  /** Our secret nonce, echoed back on the callback to authenticate it. */
  nonce: string;
  /** Round-tripped custom fields (e.g. our userId / plan). */
  userId?: string;
  plan?: string;
}

export interface CreateLinkResult {
  paymentUrl: string;
  processId: string;
  processToken: string;
}

/**
 * POST the order to the Make "Custom webhook"; the scenario creates a recurring
 * Grow payment link and returns { url, processId, processToken }. Throws on any
 * transport error or malformed response so the caller can surface a retry.
 */
export async function createPaymentLink(input: CreateLinkInput): Promise<CreateLinkResult> {
  const webhookUrl = env("MAKE_GROW_CREATE_LINK_WEBHOOK_URL");
  if (!webhookUrl) throw new Error("MAKE_GROW_CREATE_LINK_WEBHOOK_URL is not configured.");

  const payload = {
    // Shared secret the Make scenario can filter on (optional hardening).
    secret: env("MAKE_WEBHOOK_SHARED_SECRET"),
    sum: (input.amountMinor / 100).toFixed(2),
    description: input.description,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    successUrl: input.successUrl,
    notifyUrl: input.notifyUrl,
    recurring: true,
    cField1: input.nonce,
    cField2: input.userId,
    cField3: input.plan,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Make create-link webhook returned HTTP ${res.status}`);

  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Make create-link webhook returned a non-JSON body");
  }

  // Accept both our clean keys and Grow's verbose ones, in case the scenario
  // maps the raw Grow output straight through.
  const url = str(body.url ?? body.paymentUrl ?? body.URL);
  const processId = str(body.processId ?? body.paymentLinkProcessId ?? body["Payment Link Process ID"]);
  const processToken = str(
    body.processToken ?? body.paymentLinkProcessToken ?? body["Payment Link Process Token"],
  );

  if (!url || !processId || !processToken) {
    throw new Error("Make create-link webhook response missing url/processId/processToken");
  }
  return { paymentUrl: url, processId, processToken };
}

// ---------------------------------------------------------------------------
// approveTransaction — optional ack so Grow stops re-notifying (via Make)
// ---------------------------------------------------------------------------

/**
 * Acknowledge a received notification through an optional second Make webhook
 * (which calls Grow "Approve Transaction"). Best-effort: without the webhook we
 * simply skip it — the notification handler is idempotent, so Grow's retries
 * (~10/20/30 min) are harmless.
 */
export async function approveTransaction(args: {
  processId: string;
  processToken: string;
  transactionId?: string;
  transactionToken?: string;
}): Promise<boolean> {
  const webhookUrl = env("MAKE_GROW_APPROVE_WEBHOOK_URL");
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env("MAKE_WEBHOOK_SHARED_SECRET"), ...args }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// cancelDirectDebit — stop the recurring standing order (optional, via Make)
// ---------------------------------------------------------------------------

/**
 * Ask Grow to stop the monthly direct debit (הוראת קבע) for this authorization,
 * via an optional Make scenario ("Make an API Call" to Grow's cancel endpoint).
 * Returns whether the stop request was accepted. When the webhook is not
 * configured this returns false — the caller still cancels locally and the
 * standing order must then be stopped manually from Grow's merchant dashboard.
 */
export async function cancelDirectDebit(directDebitId: string): Promise<boolean> {
  const webhookUrl = env("MAKE_GROW_CANCEL_WEBHOOK_URL");
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env("MAKE_WEBHOOK_SHARED_SECRET"), directDebitId }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** True when automatic direct-debit cancellation via Make is wired up. */
export function isDirectDebitCancelConfigured(): boolean {
  return !!env("MAKE_GROW_CANCEL_WEBHOOK_URL");
}

// ---------------------------------------------------------------------------
// Server-to-server callback normalization
// ---------------------------------------------------------------------------

export interface GrowCallbackEvent {
  processId?: string;
  processToken?: string;
  /** Our nonce echoed back via cField1 — matched against the stored value. */
  nonce?: string;
  paid: boolean;
  transactionId?: string;
  /** Grow direct-debit id (הוראת קבע), present once a standing order exists. */
  directDebitId?: string;
  /** True when this notification is an automatic monthly direct-debit run. */
  isRecurringRun: boolean;
  cardSuffix?: string;
  sumMinor?: number;
  statusCode?: string;
}

/** A Grow "success" status code. Approved transactions report statusCode 2 (1 also seen). */
function isPaidStatus(statusCode: unknown): boolean {
  const code = String(statusCode ?? "").trim();
  return code === "2" || code === "1";
}

function toMinor(sum: unknown): number | undefined {
  const n = typeof sum === "number" ? sum : parseFloat(String(sum ?? ""));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Parse Grow's server-to-server callback body into a normalized event. Grow
 * nests the payload under a `data` object; the route flattens JSON- and
 * form-encoded bodies into this record before calling us.
 */
export function parseCallback(payload: Record<string, unknown>): GrowCallbackEvent | null {
  const data = (payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : payload) as Record<string, unknown>;

  const processId = str(data.processId);
  const directDebitId = str(data.directDebitId ?? data.directDebit ?? data.hkId);
  const transactionId = str(data.transactionId);

  // We must be able to tie the event back to a subscription somehow.
  if (!processId && !directDebitId && !transactionId) return null;

  const paymentSource = str(data.paymentSource) ?? "";
  const paymentType = str(data.paymentType) ?? "";
  const isRecurringRun =
    paymentSource.includes("הוראת קבע") ||
    paymentType.includes("הוראת קבע") ||
    str(data.isRecurringRun) === "true";

  return {
    processId,
    processToken: str(data.processToken),
    nonce: str(data.cField1 ?? data.customFields),
    paid: isPaidStatus(data.statusCode ?? data.status),
    transactionId,
    directDebitId,
    isRecurringRun,
    cardSuffix: str(data.cardSuffix),
    sumMinor: toMinor(data.sum),
    statusCode: str(data.statusCode),
  };
}
