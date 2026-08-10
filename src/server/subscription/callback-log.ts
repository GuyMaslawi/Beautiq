/**
 * Raw capture of every notification Grow sends us about subscription money.
 *
 * Why this exists: until the first real charge runs, the exact shape of Grow's
 * callbacks is documentation, not observed fact — field names, whether sums
 * arrive in shekels or agorot, which channel reports a monthly renewal. If the
 * first payment lands in a shape we guessed wrong, every branch in the webhook
 * ends in a quiet `200 OK` and the only trace is a one-line log with three
 * hand-picked fields. That is not enough to fix anything.
 *
 * So every call is written down verbatim — including the ones we REJECTED
 * (unauthenticated, unparseable, unmatched), because those are precisely the
 * ones worth reading. Built on ActivityLog so it needs no migration, same as
 * the cron heartbeat.
 *
 * Server-only.
 */

import { prisma } from "@/server/db/prisma";

/** What the endpoint did with the call. The vocabulary of `/admin/ops`. */
export type GrowCallbackResult =
  | "unauthenticated"
  | "unparseable"
  | "unmatched"
  | "amount_mismatch"
  | "outcome_unknown"
  | "ignored_cancelled"
  | "paid"
  | "failed";

export const CALLBACK_ACTION = "subscription.callback";

/** Hebrew label per result — this screen is read under pressure, in Hebrew. */
export const CALLBACK_RESULT_HE: Record<GrowCallbackResult, string> = {
  unauthenticated: "נדחה — השולח לא אומת",
  unparseable: "נדחה — לא הצלחנו לפרסר",
  unmatched: "לא נמצא מנוי תואם",
  amount_mismatch: "הסכום לא תואם למנוי",
  outcome_unknown: "לא ברור אם שולם",
  ignored_cancelled: "התעלמנו — המנוי כבר מבוטל",
  paid: "תשלום אושר",
  failed: "חיוב נכשל",
};

/** Results that mean money did NOT flow the way it should have. */
const PROBLEM_RESULTS: ReadonlySet<GrowCallbackResult> = new Set([
  "unauthenticated",
  "unparseable",
  "unmatched",
  "amount_mismatch",
  "outcome_unknown",
]);

/** Longest raw body we keep. Grow's payloads are small; this is a sanity cap. */
const MAX_RAW = 4000;

/**
 * Strip our own secrets out of the body before it is stored.
 *
 * The identifying parameter Grow echoes back IS the shared secret, so the raw
 * body of an authentic call contains it in plaintext — writing that to a table
 * any admin screen can read would turn an audit trail into a credential leak.
 */
function redact(raw: string, secrets: (string | undefined)[]): string {
  let out = raw;
  for (const secret of secrets) {
    if (!secret || secret.length < 8) continue;
    out = out.split(secret).join("[סוד]");
  }
  return out.length > MAX_RAW ? `${out.slice(0, MAX_RAW)}…` : out;
}

export interface GrowCallbackRecord {
  result: GrowCallbackResult;
  /** The body exactly as received, before any parsing. */
  raw: string;
  contentType?: string;
  /** Secrets to scrub out of `raw` before storing. */
  secrets?: (string | undefined)[];
  subscriptionId?: string;
  userId?: string;
  processId?: string;
  directDebitId?: string;
  transactionId?: string;
  statusCode?: string;
  sumMinor?: number;
  isRecurringRun?: boolean;
  note?: string;
}

/**
 * Write one callback down. Best-effort by design: an audit row must never be
 * the reason a paying customer's activation fails.
 */
export async function recordGrowCallback(entry: GrowCallbackRecord): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        businessId: null,
        userId: entry.userId ?? null,
        actorType: "system",
        category: "subscription",
        action: CALLBACK_ACTION,
        summary: `חיווי מ-Grow: ${CALLBACK_RESULT_HE[entry.result]}`,
        metadata: {
          result: entry.result,
          isProblem: PROBLEM_RESULTS.has(entry.result),
          raw: redact(entry.raw, entry.secrets ?? []),
          contentType: entry.contentType ?? null,
          subscriptionId: entry.subscriptionId ?? null,
          processId: entry.processId ?? null,
          directDebitId: entry.directDebitId ?? null,
          transactionId: entry.transactionId ?? null,
          statusCode: entry.statusCode ?? null,
          sumMinor: entry.sumMinor ?? null,
          isRecurringRun: entry.isRecurringRun ?? null,
          note: entry.note ?? null,
        },
      },
    });
  } catch {
    // Telemetry never breaks the payment path.
  }
}

export interface GrowCallbackRow {
  id: string;
  createdAt: Date;
  result: GrowCallbackResult;
  isProblem: boolean;
  raw: string;
  directDebitId: string | null;
  processId: string | null;
  statusCode: string | null;
  sumMinor: number | null;
  isRecurringRun: boolean | null;
  note: string | null;
}

/** The most recent callbacks, newest first — for the ops screen. */
export async function findRecentGrowCallbacks(limit = 15): Promise<GrowCallbackRow[]> {
  const rows = await prisma.activityLog.findMany({
    where: { action: CALLBACK_ACTION },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, createdAt: true, metadata: true },
  });

  return rows.map((row) => {
    const m = (row.metadata ?? {}) as Record<string, unknown>;
    const result = (m.result as GrowCallbackResult) ?? "unparseable";
    return {
      id: row.id,
      createdAt: row.createdAt,
      result,
      isProblem: m.isProblem === true,
      raw: typeof m.raw === "string" ? m.raw : "",
      directDebitId: (m.directDebitId as string | null) ?? null,
      processId: (m.processId as string | null) ?? null,
      statusCode: (m.statusCode as string | null) ?? null,
      sumMinor: typeof m.sumMinor === "number" ? m.sumMinor : null,
      isRecurringRun: typeof m.isRecurringRun === "boolean" ? m.isRecurringRun : null,
      note: (m.note as string | null) ?? null,
    };
  });
}

/** How many recent callbacks went wrong — drives the ops-screen check. */
export async function countProblemGrowCallbacks(sinceDays = 30): Promise<number> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await prisma.activityLog.findMany({
    where: { action: CALLBACK_ACTION, createdAt: { gte: since } },
    select: { metadata: true },
    take: 500,
  });
  return rows.filter((r) => ((r.metadata ?? {}) as Record<string, unknown>).isProblem === true)
    .length;
}
