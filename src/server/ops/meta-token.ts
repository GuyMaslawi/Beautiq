/**
 * בדיקת הטוקן של Meta שיושב *בפועל* בפרודקשן.
 *
 * למה זה קיים: קיומו של System User בהגדרות העסק אצל Meta לא מעיד על כלום —
 * מה שקובע הוא איזה טוקן הוגדר ב-`META_WHATSAPP_ACCESS_TOKEN`. טוקן של משתמש
 * רגיל פג אחרי 60 יום, וכשזה קורה ההודעות פשוט מפסיקות לצאת באמצע החודש
 * (שגיאה 190) — בלי שום התראה מראש. הערך עצמו מוצפן ב-Vercel ואי אפשר לקרוא
 * אותו כדי לבדוק ידנית, ולכן השרת שואל את Meta בשם עצמו.
 *
 * Server-only. הטוקן לעולם אינו מוחזר, נרשם בלוג או מוצג.
 */

const DEBUG_TIMEOUT_MS = 6000;

export interface MetaTokenStatus {
  /** אין טוקן מוגדר כלל. */
  configured: boolean;
  /** Meta אישרה שהטוקן תקף. */
  valid: boolean;
  /** ללא תפוגה — כלומר טוקן של System User. */
  neverExpires: boolean;
  /** מתי פג, כשיש תפוגה. */
  expiresAt: Date | null;
  /** כמה ימים נותרו עד התפוגה (null = ללא תפוגה / לא ידוע). */
  daysLeft: number | null;
  /** סוג הטוקן כפי ש-Meta מדווחת (USER / SYSTEM_USER / PAGE...). */
  type: string | null;
  /** ההרשאות שנצרבו בטוקן. */
  scopes: string[];
  /** הבדיקה עצמה לא הצליחה לרוץ (רשת / הרשאה) — לא אומר שהטוקן פגום. */
  checkFailed: boolean;
  error?: string;
}

/** מסיר כל מחרוזת שנראית כמו טוקן מהודעת שגיאה. */
function scrub(msg: string): string {
  return msg.replace(/EAA\S+/g, "[token]");
}

export async function getMetaTokenStatus(): Promise<MetaTokenStatus> {
  const empty: MetaTokenStatus = {
    configured: false,
    valid: false,
    neverExpires: false,
    expiresAt: null,
    daysLeft: null,
    type: null,
    scopes: [],
    checkFailed: false,
  };

  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) return empty;

  const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";
  const url =
    `https://graph.facebook.com/${apiVersion}/debug_token` +
    `?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(DEBUG_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: {
        is_valid?: boolean;
        expires_at?: number;
        data_access_expires_at?: number;
        type?: string;
        scopes?: string[];
      };
      error?: { message?: string };
    };

    if (!res.ok || !body.data) {
      return {
        ...empty,
        configured: true,
        checkFailed: true,
        error: scrub(body.error?.message ?? `HTTP ${res.status}`),
      };
    }

    const d = body.data;
    // ב-Graph API הערך 0 (או היעדרו) פירושו "ללא תפוגה" — כך נראה טוקן של
    // System User שהונפק עם expiration=Never.
    const expUnix = d.expires_at ?? 0;
    const neverExpires = expUnix === 0;
    const expiresAt = neverExpires ? null : new Date(expUnix * 1000);

    return {
      configured: true,
      valid: d.is_valid === true,
      neverExpires,
      expiresAt,
      daysLeft: expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
        : null,
      type: d.type ?? null,
      scopes: d.scopes ?? [],
      checkFailed: false,
    };
  } catch (err) {
    return {
      ...empty,
      configured: true,
      checkFailed: true,
      error: err instanceof Error ? scrub(err.message) : "שגיאת רשת",
    };
  }
}
