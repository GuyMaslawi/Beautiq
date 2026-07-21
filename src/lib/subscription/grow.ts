/**
 * Grow (Meshulam) payment adapter — self-serve Allura subscriptions.
 *
 * The owner pays Allura for their monthly plan on Grow's SECURE hosted page —
 * Allura never sees or stores card numbers. The flow is:
 *   1. createPaymentProcess() → a hosted payment URL + processId/processToken.
 *   2. The owner pays on Grow's page and is returned to our successUrl.
 *   3. Grow POSTs a server-to-server notification to our notifyUrl (the source
 *      of truth), which we verify and then activate the plan.
 *   4. We ask Grow to save a card token (saveCardToken=1) so the recurring
 *      monthly renewals can be charged server-side via chargeToken().
 *
 * Confirmation NEVER comes from the browser redirect alone — it comes from a
 * verified server notification (or a server-side getPaymentProcessInfo check).
 *
 * Grow API reference: https://developers.grow.business/reference
 * All requests are form-urlencoded POSTs; responses are `{ status, data, err }`
 * where status === 1 means success.
 *
 * Server-only — never import from a client component.
 */

// ---------------------------------------------------------------------------
// Configuration & env gating
// ---------------------------------------------------------------------------

/** Grow charge type — 1 = a regular (immediate) charge. */
const CHARGE_TYPE_REGULAR = 1;

function env(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * True when real Grow billing is fully configured. Requires the outer feature
 * flag AND the merchant identifiers. Tests / dev never set these, so the
 * subscription flow falls back to a safe dev activation and no network call is made.
 */
export function isGrowConfigured(): boolean {
  return (
    (process.env.SUBSCRIPTIONS_ENABLED ?? "").trim().toLowerCase() === "true" &&
    !!env("GROW_USER_ID") &&
    !!env("GROW_PAGE_CODE")
  );
}

/** Base URL for the Grow "light server" API, sandbox vs production by GROW_ENV. */
function growBaseUrl(): string {
  const override = env("GROW_API_BASE");
  if (override) return override.replace(/\/$/, "");
  const isProd = (env("GROW_ENV") ?? "production").toLowerCase() === "production";
  return isProd
    ? "https://secure.meshulam.co.il/api/light/server/1.0"
    : "https://sandbox.meshulam.co.il/api/light/server/1.0";
}

interface GrowCreds {
  userId: string;
  pageCode: string;
}

function requireCreds(): GrowCreds {
  const userId = env("GROW_USER_ID");
  const pageCode = env("GROW_PAGE_CODE");
  if (!userId || !pageCode) {
    throw new Error("Grow is not configured (GROW_USER_ID / GROW_PAGE_CODE missing).");
  }
  return { userId, pageCode };
}

// ---------------------------------------------------------------------------
// Low-level request helper
// ---------------------------------------------------------------------------

export interface GrowResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
  /** Grow error object/message when status !== 1. Never contains card data. */
  error?: string;
}

async function growPost<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<GrowResponse<T>> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    body.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${growBaseUrl()}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let json: { status?: number; data?: T; err?: unknown } = {};
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      return { ok: false, status: 0, data: {} as T, error: `Non-JSON response (HTTP ${res.status})` };
    }

    const status = typeof json.status === "number" ? json.status : 0;
    const ok = res.ok && status === 1;
    return {
      ok,
      status,
      data: (json.data ?? {}) as T,
      error: ok ? undefined : summarizeGrowError(json.err) ?? `Grow status ${status}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Pull a short, safe message out of Grow's err field — never card data. */
function summarizeGrowError(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err.slice(0, 300);
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const msg = o.message ?? o.errMsg ?? o.error ?? o.text;
    if (typeof msg === "string") return msg.slice(0, 300);
    return JSON.stringify(o).slice(0, 300);
  }
  return String(err).slice(0, 300);
}

// ---------------------------------------------------------------------------
// createPaymentProcess — build a hosted payment page
// ---------------------------------------------------------------------------

export interface CreateProcessInput {
  /** Amount in agorot (₪1 = 100). Converted to shekels for Grow. */
  amountMinor: number;
  description: string;
  fullName: string;
  phone: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /** Our secret nonce, echoed back on the callback to authenticate it. */
  nonce: string;
  /** Extra custom field (e.g. userId) round-tripped through Grow. */
  cField2?: string;
  cField3?: string;
  /** Save a reusable card token for recurring monthly renewals. Default true. */
  saveCardToken?: boolean;
}

export interface CreateProcessResult {
  paymentUrl: string;
  processId: string;
  processToken: string;
}

export async function createPaymentProcess(
  input: CreateProcessInput,
): Promise<CreateProcessResult> {
  const { userId, pageCode } = requireCreds();

  const res = await growPost<{
    url?: string;
    processId?: string | number;
    processToken?: string;
  }>("createPaymentProcess", {
    userId,
    pageCode,
    sum: (input.amountMinor / 100).toFixed(2),
    description: input.description,
    chargeType: CHARGE_TYPE_REGULAR,
    paymentNum: 1,
    saveCardToken: input.saveCardToken === false ? 0 : 1,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    notifyUrl: input.notifyUrl,
    "pageField[fullName]": input.fullName,
    "pageField[phone]": input.phone,
    "pageField[email]": input.email,
    cField1: input.nonce,
    cField2: input.cField2,
    cField3: input.cField3,
  });

  if (!res.ok || !res.data.url || res.data.processId === undefined || !res.data.processToken) {
    throw new Error(res.error ?? "Grow createPaymentProcess failed");
  }

  return {
    paymentUrl: String(res.data.url),
    processId: String(res.data.processId),
    processToken: String(res.data.processToken),
  };
}

// ---------------------------------------------------------------------------
// approveTransaction — acknowledge a received server notification
// ---------------------------------------------------------------------------

export async function approveTransaction(args: {
  processId: string;
  processToken: string;
}): Promise<boolean> {
  const { userId, pageCode } = requireCreds();
  try {
    const res = await growPost("approveTransaction", {
      userId,
      pageCode,
      processId: args.processId,
      processToken: args.processToken,
    });
    return res.ok;
  } catch {
    // Grow processes the transaction regardless of this ack — never fatal.
    return false;
  }
}

// ---------------------------------------------------------------------------
// getPaymentProcessInfo — server-side status check (redirect fallback path)
// ---------------------------------------------------------------------------

export interface ProcessInfo {
  paid: boolean;
  transactionId?: string;
  cardToken?: string;
  cardSuffix?: string;
  sumMinor?: number;
  statusCode?: string;
}

/**
 * Ask Grow for the authoritative status of a process. Used by the return route
 * so we do not depend on the async webhook having already landed. Best-effort:
 * returns { paid:false } on any error.
 */
export async function getPaymentProcessInfo(args: {
  processId: string;
  processToken: string;
}): Promise<ProcessInfo> {
  const { userId, pageCode } = requireCreds();
  try {
    const res = await growPost<Record<string, unknown>>("getPaymentProcessInfo", {
      userId,
      pageCode,
      processId: args.processId,
      processToken: args.processToken,
    });
    if (!res.ok) return { paid: false };

    // Grow nests the transaction under data.transactions[0] (or data itself).
    const data = res.data as Record<string, unknown>;
    const txnList = Array.isArray(data.transactions) ? (data.transactions as unknown[]) : [];
    const txn = (txnList[0] ?? data) as Record<string, unknown>;
    return normalizeTransaction(txn);
  } catch {
    return { paid: false };
  }
}

// ---------------------------------------------------------------------------
// chargeToken — recurring monthly renewal (server-to-server, no hosted page)
// ---------------------------------------------------------------------------

export interface ChargeTokenResult {
  ok: boolean;
  transactionId?: string;
  cardSuffix?: string;
  error?: string;
}

/**
 * Charge a saved card token for the monthly renewal. Uses Grow's
 * createTransactionWithToken endpoint. Failures are returned (never thrown) so
 * the renewal cron can mark the subscription past_due and move on.
 */
export async function chargeToken(args: {
  cardToken: string;
  amountMinor: number;
  description: string;
}): Promise<ChargeTokenResult> {
  const { userId, pageCode } = requireCreds();
  try {
    const res = await growPost<Record<string, unknown>>("createTransactionWithToken", {
      userId,
      pageCode,
      sum: (args.amountMinor / 100).toFixed(2),
      description: args.description,
      chargeType: CHARGE_TYPE_REGULAR,
      paymentNum: 1,
      cardToken: args.cardToken,
    });
    if (!res.ok) return { ok: false, error: res.error };

    const data = res.data as Record<string, unknown>;
    const txn = (Array.isArray(data.transactions) ? (data.transactions as unknown[])[0] : data) as Record<
      string,
      unknown
    >;
    const norm = normalizeTransaction(txn);
    return {
      ok: norm.paid,
      transactionId: norm.transactionId,
      cardSuffix: norm.cardSuffix,
      error: norm.paid ? undefined : "charge not approved",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "charge failed" };
  }
}

// ---------------------------------------------------------------------------
// Server-to-server callback normalization
// ---------------------------------------------------------------------------

export interface GrowCallbackEvent {
  processId: string;
  processToken: string;
  /** Our nonce echoed back via cField1 — matched against the stored value. */
  nonce?: string;
  paid: boolean;
  transactionId?: string;
  cardToken?: string;
  cardSuffix?: string;
  sumMinor?: number;
  statusCode?: string;
}

/** A Grow "success" status code. Approved transactions report statusCode 2. */
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

/** Normalize a Grow transaction/callback object (from callback, info, or charge). */
function normalizeTransaction(o: Record<string, unknown>): ProcessInfo {
  return {
    paid: isPaidStatus(o.statusCode ?? o.status),
    transactionId: str(o.transactionId),
    cardToken: str(o.cardToken ?? o.token),
    cardSuffix: str(o.cardSuffix),
    sumMinor: toMinor(o.sum),
    statusCode: str(o.statusCode),
  };
}

/**
 * Parse Grow's server-to-server callback body into a normalized event. Grow
 * nests the payload under a `data` object; the fields may arrive JSON- or
 * form-encoded (the route flattens both into this record).
 */
export function parseCallback(payload: Record<string, unknown>): GrowCallbackEvent | null {
  const data = (payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : payload) as Record<string, unknown>;

  const processId = str(data.processId);
  const processToken = str(data.processToken);
  if (!processId || !processToken) return null;

  const norm = normalizeTransaction(data);
  return {
    processId,
    processToken,
    nonce: str(data.cField1 ?? data.customFields),
    paid: norm.paid,
    transactionId: norm.transactionId,
    cardToken: norm.cardToken,
    cardSuffix: norm.cardSuffix,
    sumMinor: norm.sumMinor,
    statusCode: norm.statusCode,
  };
}
