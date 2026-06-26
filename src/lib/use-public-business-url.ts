"use client";

import { useSyncExternalStore } from "react";
import { publicBusinessUrl, publicBusinessUrlClient } from "@/lib/config";

// No external store to watch — the value only depends on slug + render environment.
const noopSubscribe = () => () => {};

/**
 * קישור ההזמנה הציבורי להצגה בדפדפן.
 * בשרת (ובצעד ההידרציה הראשון) מחזיר את הדומיין הקנוני כדי למנוע hydration mismatch,
 * ולאחר ההידרציה מחזיר את הכתובת המותאמת ל-origin הנוכחי (localhost/preview) או לדומיין
 * הקנוני כשמוגדר NEXT_PUBLIC_APP_URL.
 */
export function usePublicBusinessUrl(slug: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => publicBusinessUrlClient(slug),
    () => publicBusinessUrl(slug),
  );
}
