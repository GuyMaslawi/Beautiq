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

import { secretEquals } from "@/lib/secret-compare";

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

/**
 * A name Grow's payment page will accept: two parts, each at least 2 characters.
 *
 * Grow validates this and refuses to create the link otherwise, which would fail
 * checkout entirely — and a single-word name is completely ordinary here ("יעל",
 * "מיכל"). The name is a prefill for the payer, not the invoice: Grow bills to
 * whatever she types on its own page. So when the real name cannot satisfy the
 * rule, a neutral placeholder is far better than a blocked payment.
 */
export function growPayerName(name: string | null | undefined): string {
  const parts = (name ?? "")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  return parts.length >= 2 ? parts.join(" ") : "לקוחת Allura";
}

/**
 * A phone Grow's payment page will accept: a valid Israeli mobile.
 *
 * The paywall sits BEFORE onboarding, so the ordinary case — a brand-new signup
 * paying for the first time — has no business yet and therefore no phone at all.
 * Grow marks the field required and refuses to create the link without it, which
 * would fail checkout for every new owner, i.e. all of them.
 *
 * Like the name, this is a prefill the payer can change on Grow's own page, and
 * no SMS is sent (Sending Mode is `none`). `GROW_FALLBACK_PHONE` lets the
 * placeholder be a real reachable number instead of the neutral default.
 */
export function growPayerPhone(phone: string | null | undefined): string {
  const valid = (candidate: string): string | undefined => {
    const digits = candidate.replace(/\D/g, "");
    // Accept the international form the owner may have saved (+972-52-…).
    const local = digits.startsWith("972") ? `0${digits.slice(3)}` : digits;
    return /^05\d{8}$/.test(local) ? local : undefined;
  };

  return valid(phone ?? "") ?? valid(process.env.GROW_FALLBACK_PHONE ?? "") ?? "0500000000";
}

export interface CreateLinkInput {
  /** Amount in agorot (₪1 = 100). Sent to Make in shekels. */
  amountMinor: number;
  description: string;
  fullName: string;
  phone: string;
  email?: string;
  successUrl: string;
  /** Where Grow returns the owner if she abandons the payment page. */
  cancelUrl: string;
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

  // The payload must match the sample bundle the Make scenario learned its data
  // structure from, field for field. Make maps Grow's required `price` from
  // `sum`; anything Make cannot resolve arrives at Grow empty and the scenario
  // dies with "Missing value of required parameter 'price'" before Grow is even
  // called. Two things were off:
  //   - `sum` was sent as the STRING "199.00" while the learned sample carried a
  //     number, and Grow's price is a strict numeric field;
  //   - `cancelUrl` existed in the sample and was never sent at all.
  // Both are now sent in the shape the scenario expects.
  const payload = {
    // Shared secret the Make scenario can filter on (optional hardening).
    secret: env("MAKE_WEBHOOK_SHARED_SECRET"),
    sum: Math.round(input.amountMinor) / 100,
    description: input.description,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
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

  const text = await res.text();

  // Carry Make's own words into the error. Without this the alert said only
  // "returned HTTP 400" and the actual reason — a Grow validation failure, a
  // dead connection, an inactive scenario — was visible nowhere but Make's
  // execution history. The body of a FAILED create-link call carries no payment
  // link and therefore no process token.
  if (!res.ok) {
    throw new Error(
      `Make create-link webhook returned HTTP ${res.status}: ${text.slice(0, 300) || "(empty body)"}`,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // A scenario with no Webhook-Response module answers "Accepted"; an inactive
    // one says so in plain text. Both land here, and both are worth naming.
    throw new Error(
      `Make create-link webhook returned a non-JSON body: ${text.slice(0, 200) || "(empty body)"}`,
    );
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

/**
 * What the notification says happened to the money.
 *
 * `unknown` is not a formality — it is the only honest answer for a payload
 * that carries neither an approval status nor a failure reason, and both
 * alternatives are dangerous: calling it paid grants a free month, calling it
 * failed puts a paying customer into `past_due` and eventually locks her out.
 * The route parks such an event and alerts instead of guessing.
 */
export type GrowChargeOutcome = "paid" | "failed" | "unknown";

export interface GrowCallbackEvent {
  /**
   * Every id in the callback that could match the `processId` we stored at
   * checkout, most likely first.
   *
   * Grow's callback carries TWO process pairs and they are not interchangeable:
   * `paymentLinkProcessId` is the payment LINK (what "Create Payment Link"
   * returned to us and what we stored), while `processId` identifies the
   * transaction that link produced. Matching only on `processId` looked right
   * and found nothing — the payment was received, authenticated, and then
   * dropped as "no subscription for notification".
   */
  processIds: string[];
  /** The tokens paired with `processIds`, in the same order. */
  processTokens: string[];
  /** Primary process id — first of `processIds`, for logging and lookups. */
  processId?: string;
  processToken?: string;
  /** Our nonce echoed back via cField1 — matched against the stored value. */
  nonce?: string;
  outcome: GrowChargeOutcome;
  transactionId?: string;
  /** Grow direct-debit id (הוראת קבע), present once a standing order exists. */
  directDebitId?: string;
  /** Grow's second handle on the same standing order, sent alongside it. */
  recurringDebitId?: string;
  /** True when this notification is an automatic monthly direct-debit run. */
  isRecurringRun: boolean;
  cardSuffix?: string;
  sumMinor?: number;
  statusCode?: string;
  /** Grow's own words on a failed direct-debit run (`error_message`). */
  failureReason?: string;
  /** How many times Grow has already retried this standing order. */
  attempts?: number;
}

/** A Grow "success" status code. Approved transactions report statusCode 2 (1 also seen). */
const SUCCESS_STATUS_CODES = new Set(["1", "2"]);

function toMinor(sum: unknown): number | undefined {
  const n = typeof sum === "number" ? sum : parseFloat(String(sum ?? ""));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

/**
 * Our checkout nonce, echoed back by Grow.
 *
 * Grow returns the custom fields NESTED — `customFields.cField1` — not as a flat
 * `cField1`, and an older empty-scenario shape put a bare string there instead.
 * Reading the container itself stringified an object into "[object Object]",
 * so the value we deliberately round-trip for authentication never once took
 * part in it.
 */
function readNonce(data: Record<string, unknown>): string | undefined {
  const custom = data.customFields;
  if (custom && typeof custom === "object") {
    const nested = str((custom as Record<string, unknown>).cField1);
    if (nested) return nested;
  }
  return str(data.cField1) ?? (typeof custom === "string" ? str(custom) : undefined);
}

/** True only for a value that parses to a number greater than zero. */
function positive(v: unknown): boolean {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0;
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Parse Grow's server-to-server callback body into a normalized event.
 *
 * Grow speaks to us over THREE channels, and each one names the same things
 * differently — the field lists below are the union, not redundancy:
 *
 *  1. the per-link `notifyUrl` we pass when creating the payment link
 *     (PaymentLinks shape: `processId`, `statusCode`, `sum`);
 *  2. the account-level webhook of type "עדכון לאחר ביצוע עסקה", which is the
 *     ONLY channel that reports the automatic monthly direct-debit runs — and
 *     only when the "ריצות הוראת קבע" report is ticked (transaction shape:
 *     `paymentSum`, `transactionCode`, `asmachta`, `directDebitId`);
 *  3. the account-level webhook of type "עדכון עבור הוראת קבע שנכשלה", which
 *     fires only on a failed standing order and identifies it by
 *     `regular_payment_id`, with `error_message` / `charges_attempts`.
 *
 * Grow nests the payload under a `data` object; the route flattens JSON- and
 * form-encoded bodies into this record before calling us.
 */
export function parseCallback(payload: Record<string, unknown>): GrowCallbackEvent | null {
  const data = (payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : payload) as Record<string, unknown>;

  // The payment-link pair first: that is the one we stored at checkout. The
  // transaction-level pair is kept as a fallback for any channel that sends
  // only it.
  const processIds = [str(data.paymentLinkProcessId), str(data.processId)].filter(
    (v): v is string => !!v,
  );
  const processTokens = [str(data.paymentLinkProcessToken), str(data.processToken)].filter(
    (v): v is string => !!v,
  );
  const processId = processIds[0];

  // `regular_payment_id` is how the failed-standing-order webhook names the
  // authorization; every other channel calls it `directDebitId`. Grow also
  // sends `recurringDebitId` alongside — a second handle on the same standing
  // order, kept as a lookup candidate for the monthly runs.
  const regularPaymentId = str(data.regular_payment_id ?? data.regularPaymentId);
  const directDebitId =
    str(data.directDebitId ?? data.directDebit ?? data.hkId) ?? regularPaymentId;
  const recurringDebitId = str(data.recurringDebitId);
  const transactionId = str(data.transactionId ?? data.transactionCode);

  // We must be able to tie the event back to a subscription somehow.
  if (!processId && !directDebitId && !transactionId) return null;

  const paymentSource = str(data.paymentSource) ?? "";
  const paymentType = str(data.paymentType) ?? "";
  const isRecurringRun =
    paymentSource.includes("הוראת קבע") ||
    paymentType.includes("הוראת קבע") ||
    str(data.isRecurringRun) === "true" ||
    !!regularPaymentId ||
    // Only a NON-ZERO periodical sum is evidence. Grow sends
    // `periodicalPaymentSum=0` on every callback including a first purchase, so
    // testing for the field's presence marked every payment as a renewal — and
    // a failed FIRST charge would then have been treated as a failed renewal
    // and lapsed the account instead of leaving it pending to retry.
    positive(data.periodicalPaymentSum) ||
    // No processId of ours + a standing order id can only be an automatic run:
    // the first charge always carries the processId we created the link with.
    (!processId && !!directDebitId);

  const failureReason = str(data.error_message ?? data.errorMessage);
  const statusCode = str(data.statusCode ?? data.status);

  // Failure evidence wins over a status code: the failed-standing-order webhook
  // fires ONLY on a failure, and may well carry the attempt's own status.
  let outcome: GrowChargeOutcome;
  if (failureReason) outcome = "failed";
  else if (statusCode && SUCCESS_STATUS_CODES.has(statusCode)) outcome = "paid";
  else if (statusCode) outcome = "failed";
  else outcome = "unknown";

  const attempts = Number(str(data.charges_attempts ?? data.chargesAttempts));

  return {
    processIds,
    processTokens,
    processId,
    processToken: processTokens[0],
    nonce: readNonce(data),
    outcome,
    transactionId,
    directDebitId,
    recurringDebitId,
    isRecurringRun,
    cardSuffix: str(data.cardSuffix),
    sumMinor: toMinor(data.sum ?? data.paymentSum ?? data.periodicalPaymentSum),
    statusCode: str(data.statusCode),
    failureReason,
    attempts: Number.isFinite(attempts) && attempts > 0 ? attempts : undefined,
  };
}

// ---------------------------------------------------------------------------
// Sender authentication — the constant "פרמטר מזהה" Grow echoes in every body
// ---------------------------------------------------------------------------

/**
 * True when the notification body carries our shared secret anywhere in it.
 *
 * Grow's account-level webhooks authenticate by ECHOING a constant we configure
 * ("פרמטר מזהה" — "ערך קבוע שיישלח עם כל עדכון... שמאפשר לזהות את מקור
 * הקריאה"), plus a `webhookKey`. Neither is a header and neither is a query
 * parameter, so the `?t=` check that guards the per-link callback rejects this
 * entire channel — which is every monthly renewal we will ever receive.
 *
 * We deliberately do not hard-code the key name: Grow's docs and its dashboard
 * disagree about what the identifying parameter is called, and a wrong guess
 * fails closed on real money. Scanning the values instead is not weaker — a
 * caller who does not hold the secret cannot put it anywhere in the body.
 */
export function bodyCarriesSecret(
  payload: Record<string, unknown>,
  secret: string | undefined,
): boolean {
  if (!secret) return false;

  const nested = payload.data && typeof payload.data === "object" ? payload.data : {};
  const values = [
    ...Object.values(payload),
    ...Object.values(nested as Record<string, unknown>),
  ];

  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    // Bound the work: a hostile body cannot make us hash a megabyte per field.
    const candidate = String(value);
    if (candidate.length > 256) continue;
    if (secretEquals(candidate, secret)) return true;
  }
  return false;
}
