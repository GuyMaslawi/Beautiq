/**
 * WhatsApp onboarding "tracks" — the owner's chosen way to connect a number.
 *
 * Most beauty business owners in Israel already have a WhatsApp number on their
 * phone (a regular number or the WhatsApp Business app) and do NOT want a
 * brand-new number — so that is the recommended track. The "existing_business_app"
 * track is the rare/advanced case: a number that is ALREADY managed through Meta
 * Business / WhatsApp Cloud API. Owners kept confusing "I have the WhatsApp
 * Business mobile app" with "I have a Meta-managed Cloud API number" and picking
 * that track by mistake (Meta then fails immediately), so the copy below steers
 * them firmly toward the phone-number track unless they truly have a Cloud API
 * number. This module holds the owner-facing Hebrew guidance for each track plus
 * small pure helpers used by the connection card and its tests.
 *
 * IMPORTANT: the track is the owner's *stated intent*. Meta does not reliably
 * report back which path actually happened, so we never claim a connection is
 * "coexistence" as fact — we only use the track to guide the owner and to label
 * the confirmation step honestly.
 */

export type ConnectionTrack = "existing_business_app" | "personal" | "new_number";

/** Stored on WhatsAppConnection.connectionSource. "unknown" is the legacy/default. */
export type ConnectionSource = ConnectionTrack | "unknown";

export interface ConnectionTrackInfo {
  track: ConnectionTrack;
  /** Short Hebrew option title shown in the chooser. */
  title: string;
  /** One-line Hebrew description under the title. */
  description: string;
  /** Longer Hebrew explanation shown after the option is selected. */
  explanation: string;
  /** "מומלץ לרוב העסקים" recommended badge text, when applicable. */
  recommendedBadge?: string;
  /** "מתקדם בלבד" advanced badge text, for the Cloud-API-managed track only. */
  advancedBadge?: string;
  /** Warning shown before launching Meta (personal numbers only). */
  warning?: string;
  /** Extra acknowledgement the owner must confirm before launch (personal only). */
  ackWarning?: string;
}

export const CONNECTION_TRACKS: ConnectionTrackInfo[] = [
  {
    track: "personal",
    title: "יש לי WhatsApp רגיל/עסקי בטלפון",
    description:
      "זו האפשרות המתאימה לרוב העסקים — נחבר את המספר שכבר נמצא אצלך בטלפון, בין אם זה WhatsApp רגיל ובין אם זו אפליקציית WhatsApp Business.",
    explanation:
      "בחלון של Meta המשיכי לפי ההוראות כדי לחבר את המספר שכבר נמצא אצלך בטלפון. אם המספר כבר פעיל ב־WhatsApp, ייתכן שתתבקשי לאמת אותו במהלך החיבור — זה חלק תקין מהתהליך של Meta. בסיום תחזרי ל־Allura ונבדוק שהחיבור הצליח.",
    recommendedBadge: "מומלץ לרוב העסקים",
    warning:
      "אם המספר כבר פעיל ב־WhatsApp, ייתכן שתתבקשי לאמת אותו או לאשר העברה במהלך החיבור.",
    ackWarning:
      "הבנתי — ייתכן ש־Meta תבקש לאמת או להעביר את המספר כדי להשלים את החיבור.",
  },
  {
    track: "new_number",
    title: "אין לי מספר עסקי / אני רוצה מספר חדש",
    description:
      "נפתח מספר עסקי חדש לעסק. המספר צריך להיות זמין לקבלת קוד אימות ולא להיות רשום כבר ב־WhatsApp.",
    explanation:
      "בחלון של Meta הזיני את המספר החדש. המספר יקבל קוד אימות מ־WhatsApp. ודאי שהמספר זמין לקבלת SMS או שיחה ושאינו רשום כבר ב־WhatsApp. בסיום תחזרי ל־Allura ונבדוק שהחיבור הצליח.",
  },
  {
    track: "existing_business_app",
    title: "יש לי מספר שמחובר כבר ל־Meta Business",
    advancedBadge: "מתקדם בלבד",
    description:
      "בחרי בזה רק אם המספר כבר מנוהל דרך Meta Business / WhatsApp Cloud API. אם יש לך רק אפליקציית WhatsApp Business בטלפון — אל תבחרי בזה.",
    explanation:
      "המשיכי בחלון של Meta עם החשבון שכבר מנוהל אצלך ב־Meta Business / WhatsApp Cloud API. שימי לב: אם המספר אינו מנוהל כבר דרך Meta, החיבור עלול להיכשל מיד — במקרה כזה חזרי ובחרי במסלול ‘יש לי WhatsApp רגיל/עסקי בטלפון’.",
  },
];

export function getTrackInfo(track: ConnectionTrack): ConnectionTrackInfo {
  return (
    CONNECTION_TRACKS.find((t) => t.track === track) ??
    CONNECTION_TRACKS.find((t) => t.track === "new_number") ??
    CONNECTION_TRACKS[0]
  );
}

/** Owner-facing Hebrew label for a stored connection source (confirmation card). */
export function connectionSourceLabel(source?: string | null): string {
  switch (source) {
    case "existing_business_app":
      return "מספר מנוהל ב־Meta Business / Cloud API";
    case "personal":
      return "מספר רגיל או עסקי בטלפון";
    case "new_number":
      return "מספר חדש";
    default:
      return "לא ידוע";
  }
}

/**
 * Detects Meta test / placeholder numbers (the "+1 555" demo numbers Meta hands
 * out to apps in development). A business owner should never see one of these as
 * their "connected" number — it means the dev/test WABA was connected, not a
 * real business number.
 */
export function looksLikeMetaTestNumber(displayPhoneNumber?: string | null): boolean {
  if (!displayPhoneNumber) return false;
  const digits = displayPhoneNumber.replace(/\D/g, "");
  // US test numbers Meta issues look like +1 555 xxx xxxx.
  if (/^1?555\d{0,7}$/.test(digits)) return true;
  // Defensive: any number whose area/prefix block is 555.
  return /\b555\b/.test(displayPhoneNumber) || digits.includes("555000");
}

/**
 * Classifies an error surfaced by the Meta Embedded Signup popup into an
 * owner-friendly Hebrew explanation. We never show the raw Meta error to a
 * regular owner — only admins see the technical detail.
 */
export type ConnectErrorKind = "already_registered" | "generic";

export function classifyMetaConnectError(raw?: string | null): ConnectErrorKind {
  if (!raw) return "generic";
  const s = raw.toLowerCase();
  if (
    /already.*regist|regist.*already|phone number.*in use|already in use|in use.*another/.test(s) ||
    /disconnect.*from|migrate this phone|migrate.*number|number.*another account/.test(s) ||
    /133016|136025|100\b.*phone/.test(s)
  ) {
    return "already_registered";
  }
  return "generic";
}
