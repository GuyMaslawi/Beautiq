"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "./auth";
import { logActivity } from "@/server/activity/log";
import { markDirectDebitStopped } from "@/server/subscription/service";
import { captureError } from "@/lib/logger";

/**
 * Confirm that a Grow standing order was stopped by hand.
 *
 * Grow's Make app cannot cancel a recurring payment — the vendor says it has to
 * be done on the Grow site — so this is the human half of the loop: the admin
 * stops the direct debit in Grow, then records it here so the open-task list on
 * /admin/ops clears. Nothing about the subscription's access changes; that was
 * already settled when it was cancelled.
 *
 * Platform-admin only, and the write itself refuses any subscription that is
 * still live (see markDirectDebitStopped) — a mis-click must never hide a paying
 * customer's live direct debit from the list built to catch it.
 */
export async function markDirectDebitStoppedAction(
  subscriptionId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();

  if (typeof subscriptionId !== "string" || subscriptionId.length === 0) {
    return { ok: false, error: "מזהה מנוי חסר." };
  }

  try {
    const stopped = await markDirectDebitStopped(subscriptionId);
    if (!stopped) {
      return {
        ok: false,
        error: "לא ניתן לסמן — המנוי אינו ממתין לעצירה (ייתכן שכבר סומן).",
      };
    }
  } catch (err) {
    captureError("admin.direct-debit-stop", err, { subscriptionId });
    return { ok: false, error: "אירעה תקלה בסימון. נסה שוב." };
  }

  await logActivity({
    action: "subscription.direct_debit_stopped",
    category: "subscription",
    summary: "הוראת קבע סומנה כנעצרה ידנית ב-Grow",
    metadata: { subscriptionId },
  });

  revalidatePath("/admin/ops");
  return { ok: true };
}
