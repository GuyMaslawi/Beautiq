"use server";

import { randomUUID } from "crypto";
import { AccountPlan, AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCurrentUser } from "@/server/auth/session";
import { effectivePriceMinor, confirmSubscriptionPayment } from "@/server/subscription/service";
import {
  isGrowConfigured,
  createPaymentLink,
  cancelDirectDebit,
  isDirectDebitCancelConfigured,
} from "@/lib/subscription/grow";
import { ALLURA_PLAN } from "@/lib/plans";
import { SUPPORT_EMAIL } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkPersistentRateLimit } from "@/server/rate-limit/persistent";
import { logger, captureError } from "@/lib/logger";

/**
 * תקרת פתיחות תשלום לחשבון. נדיב בהרבה משימוש אמיתי (בעלת עסק פותחת תשלום
 * פעם אחת, ואולי מנסה שוב אחרי כרטיס שנדחה) — נועד ליירט לולאה או שימוש
 * לרעה, לא את מי שמתקשה לשלם.
 */
const CHECKOUT_MAX = 6;
const CHECKOUT_WINDOW_MS = 15 * 60_000;
/** מעט גבוהה מזו שבזיכרון, כדי שמופע עמוס בודד לא ייתקל בה ראשון. */
const CHECKOUT_PERSISTENT_MAX = 8;
const CHECKOUT_RATE_LIMIT_ERROR =
  "נפתחו יותר מדי בקשות תשלום בזמן קצר. יש להמתין מספר דקות ולנסות שוב.";

/**
 * Self-serve subscription checkout (see CLAUDE.md §13, [[project_subscribe_paywall]]).
 *
 * The owner pays Allura for their monthly plan on Grow's (Meshulam) SECURE
 * hosted page — Allura never handles card details. This action creates the Grow
 * payment process and returns the hosted URL to redirect to; the plan is only
 * actually activated once a payment is CONFIRMED server-side (the Grow webhook
 * or the return route), never from this call.
 *
 * Paying is mandatory: EVERY business owner pays the full plan price. There are
 * exactly two ways `User.plan` is ever set — a payment confirmed server-side by
 * Grow (confirmSubscriptionPayment), or a deliberate admin grant
 * (adminSetAccountPlanAction). A signed-up owner who has not paid simply has no
 * plan and sits behind the /subscribe gate, which is the only "free" state.
 *
 * Outside production (dev / tests) an instant local activation keeps the app
 * runnable without Grow. That shortcut is hard-blocked in production — see
 * assertCheckoutAvailable below.
 */

export interface CheckoutResult {
  ok: boolean;
  /** Where the client should navigate: Grow's hosted page, or an internal path. */
  redirectUrl?: string;
  error?: string;
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * In production, refuse to run checkout at all unless real Grow billing is wired.
 *
 * Without this, a missing `SUBSCRIPTIONS_ENABLED` / `MAKE_GROW_CREATE_LINK_WEBHOOK_URL`
 * in the deployment silently turned the paywall into a giveaway: the dev shortcut
 * below activated a full paid plan for anyone who clicked, with no
 * charge and nothing in the logs to notice. Free access must be a decision the
 * admin makes per account, never a side effect of configuration.
 *
 * Checked BEFORE any write, because the code below resets the subscription row
 * (clearing `directDebitId`) — bailing out afterwards would cut an existing
 * paying customer loose from her live standing order.
 */
function assertCheckoutAvailable(): string | null {
  if (isGrowConfigured()) return null;
  if (process.env.NODE_ENV !== "production") return null;
  return (
    "התשלום אינו זמין כרגע ולכן לא ניתן להפעיל את המנוי. " +
    `נסי שוב בעוד מספר דקות, ואם התקלה חוזרת פני אלינו ב-${SUPPORT_EMAIL}.`
  );
}

/**
 * Start checkout for the Allura subscription. There is exactly one plan, so this
 * takes no argument: the signup paywall and a re-authorization of the recurring
 * charge are the same flow at the same price.
 */
export async function startSubscriptionCheckoutAction(): Promise<CheckoutResult> {
  const user = await requireCurrentUser();

  const plan = AccountPlan.standard;

  // הגבלת קצב פר-חשבון. הפעולה הזו אינה קריאה בלבד: כל הפעלה מבקשת מ-Grow
  // לעצור את הוראת הקבע הקיימת, *מאפסת* את שורת המנוי (כולל directDebitId)
  // ומייצרת קישור תשלום חדש דרך Make. בלי תקרה, לחיצות חוזרות — או קריאה
  // ישירה ל-action id מתוך חבילת הלקוח — מייצרות סדרת קישורי תשלום, מבזבזות
  // מכסת Make, ומשאירות לקוחה משלמת בלי הוראת קבע פעילה.
  // הדלי בזיכרון בולם פרץ מיידית; הדלי במסד הוא התקרה האמיתית שמשותפת לכל
  // מופעי ה-serverless (ראו src/server/rate-limit/persistent.ts).
  if (!checkRateLimit(`checkout:${user.id}`, CHECKOUT_MAX, CHECKOUT_WINDOW_MS)) {
    return { ok: false, error: CHECKOUT_RATE_LIMIT_ERROR };
  }
  if (
    !(await checkPersistentRateLimit(
      `checkout:${user.id}`,
      CHECKOUT_PERSISTENT_MAX,
      CHECKOUT_WINDOW_MS,
    ))
  ) {
    return { ok: false, error: CHECKOUT_RATE_LIMIT_ERROR };
  }

  const unavailable = assertCheckoutAvailable();
  if (unavailable) {
    logger.error(
      "[subscription.checkout] blocked — billing is not configured in production. " +
        "Set SUBSCRIPTIONS_ENABLED=true and MAKE_GROW_CREATE_LINK_WEBHOOK_URL. " +
        "No plan was granted.",
      { userId: user.id, plan },
    );
    return { ok: false, error: unavailable };
  }

  // Capture the current standing order (if any) before we overwrite the row —
  // a re-authorization runs at the price we compute below, and Grow can't change
  // a live direct debit's amount, so the old one must be stopped to avoid double
  // billing.
  const previous = await prisma.accountSubscription.findUnique({
    where: { userId: user.id },
    select: { directDebitId: true, status: true },
  });

  // Access is open AND billing is authorized (active) — nothing to charge. A
  // `pending` sub is a re-authorization (e.g. after an admin changed the
  // negotiated price, or an abandoned checkout), so it must proceed.
  if (user.plan && previous?.status === AccountSubscriptionStatus.active) {
    return { ok: true, redirectUrl: "/dashboard" };
  }

  // An admin may have negotiated a fixed monthly price for this account; it
  // replaces the list price for this charge and every renewal that follows.
  const priceMinor = effectivePriceMinor(user.customPriceMinor);
  const nonce = randomUUID();

  // Reset the (single) subscription row to a fresh pending checkout for this plan.
  const subscription = await prisma.accountSubscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan,
      priceMinor,
      status: AccountSubscriptionStatus.pending,
      checkoutNonce: nonce,
    },
    update: {
      plan,
      priceMinor,
      status: AccountSubscriptionStatus.pending,
      checkoutNonce: nonce,
      processId: null,
      processToken: null,
      // A re-authorization is a NEW standing order, possibly at a different
      // amount. Keeping the old id let a charge from the previous authorization
      // come back and re-activate the account at the wrong price (the old direct
      // debit is only stopped best-effort, below), so it must not survive.
      directDebitId: null,
    },
  });

  // ── Dev / test only: activate immediately, no external charge. ─────────────
  // Unreachable in production — assertCheckoutAvailable() returned above.
  if (!isGrowConfigured()) {
    await confirmSubscriptionPayment(subscription, {});
    return { ok: true, redirectUrl: "/dashboard" };
  }

  // ── Real Grow hosted checkout (payment link brokered via Make) ─────────────
  try {
    // Stop the previous monthly standing order (best-effort) — the subscription
    // is charged on a fresh direct debit at the price computed above.
    if (previous?.directDebitId) {
      const stopped = await cancelDirectDebit(previous.directDebitId);
      logger.info("[subscription.checkout] previous direct debit stop requested", {
        userId: user.id,
        stopped,
      });
    }

    const base = appBaseUrl();
    // Grow signs nothing, so the notifyUrl carries our endpoint secret: Grow
    // POSTs back to exactly this URL, which lets the webhook authenticate the
    // sender on EVERY notification (including the automatic monthly runs, which
    // carry no processToken). See src/app/api/subscription/webhook/route.ts.
    const webhookSecret = process.env.SUBSCRIPTION_WEBHOOK_SECRET?.trim();
    const notifyUrl = webhookSecret
      ? `${base}/api/subscription/webhook?t=${encodeURIComponent(webhookSecret)}`
      : `${base}/api/subscription/webhook`;

    const { paymentUrl, processId, processToken } = await createPaymentLink({
      amountMinor: priceMinor,
      description: `${ALLURA_PLAN.name} — מנוי חודשי`,
      fullName: user.name ?? user.email.split("@")[0],
      phone: "",
      email: user.email,
      successUrl: `${base}/api/subscription/return`,
      notifyUrl,
      nonce,
      userId: user.id,
      plan,
    });

    await prisma.accountSubscription.update({
      where: { id: subscription.id },
      data: { processId, processToken },
    });

    logger.info("[subscription.checkout] Grow process created", {
      userId: user.id,
      plan,
      processId,
    });

    return { ok: true, redirectUrl: paymentUrl };
  } catch (err) {
    captureError("subscription.checkout", err, { userId: user.id, plan });
    return { ok: false, error: "אירעה תקלה בפתיחת עמוד התשלום. נסי שוב." };
  }
}

export interface CancelResult {
  ok: boolean;
  error?: string;
}

/**
 * Cancel the current subscription. Access continues until the end of the paid
 * period (we keep `User.plan` set); the daily sweep closes the gate once the
 * period ends. Best-effort asks Grow to stop the monthly direct debit — if that
 * is not wired through Make, the standing order is stopped manually from Grow's
 * merchant dashboard, but no further access is granted past the period regardless.
 */
export async function cancelSubscriptionAction(): Promise<CancelResult> {
  const user = await requireCurrentUser();

  const sub = await prisma.accountSubscription.findUnique({ where: { userId: user.id } });
  if (!sub) return { ok: false, error: "לא נמצא מנוי פעיל לביטול." };
  if (
    sub.status !== AccountSubscriptionStatus.active &&
    sub.status !== AccountSubscriptionStatus.past_due
  ) {
    return { ok: true }; // already cancelled/expired — nothing to do.
  }

  try {
    await prisma.accountSubscription.update({
      where: { id: sub.id },
      data: { status: AccountSubscriptionStatus.cancelled, cancelledAt: new Date() },
    });
  } catch (err) {
    captureError("subscription.cancel", err, { userId: user.id });
    return { ok: false, error: "אירעה תקלה בביטול המנוי. נסי שוב." };
  }

  // Best-effort: stop the recurring charge at Grow.
  if (sub.directDebitId) {
    const stopped = await cancelDirectDebit(sub.directDebitId);
    logger.info("[subscription.cancel] cancelled", {
      userId: user.id,
      directDebitStopped: stopped,
    });

    if (!stopped) {
      // הגישה נסגרת בסוף התקופה — אבל הוראת הקבע ב-Grow עדיין חיה וממשיכה
      // לגבות מהכרטיס של מי שכבר ביטלה. זה כסף שנלקח מלקוחה בטעות, ולכן זו
      // התראה אקטיבית ולא שורת לוג שאיש לא קורא: צריך לעצור אותה ידנית בלוח
      // הבקרה של Grow, ובהתראה יש בדיוק את המזהה הדרוש לשם כך.
      captureError(
        "subscription.cancel.direct-debit",
        new Error(
          isDirectDebitCancelConfigured()
            ? "בקשת עצירת הוראת הקבע ב-Grow נכשלה — יש לעצור אותה ידנית, אחרת הלקוחה תמשיך להיות מחויבת"
            : "ביטול הוראת קבע אוטומטי אינו מוגדר (MAKE_GROW_CANCEL_WEBHOOK_URL) — יש לעצור את הוראת הקבע ידנית ב-Grow, אחרת הלקוחה תמשיך להיות מחויבת",
        ),
        { userId: user.id, email: user.email, directDebitId: sub.directDebitId },
      );
    }
  }

  return { ok: true };
}
