/**
 * WhatsApp onboarding "tracks" — the owner's chosen way to connect a number.
 *
 * Most beauty business owners in Israel already use the WhatsApp Business App on
 * their phone and do NOT want a brand-new number. Meta's Embedded Signup can
 * onboard an existing WhatsApp Business App number (coexistence) when the Meta
 * configuration and the account/number are eligible. This module holds the
 * owner-facing Hebrew guidance for each track plus small pure helpers used by the
 * connection card and its tests.
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
  /** Warning shown before launching Meta (personal numbers only). */
  warning?: string;
  /** Extra acknowledgement the owner must confirm before launch (personal only). */
  ackWarning?: string;
}

export const CONNECTION_TRACKS: ConnectionTrackInfo[] = [
  {
    track: "existing_business_app",
    title: "יש לי WhatsApp Business קיים",
    description:
      "נחבר את מספר ה־WhatsApp Business הקיים שלך. תוכלי להמשיך להשתמש באותו מספר ולחבר אוטומציות דרך Allura.",
    explanation:
      "בחלון של Meta בחרי את חשבון ה־WhatsApp Business הקיים שלך והמשיכי לפי ההוראות. בסיום תחזרי ל־Allura ונבדוק שהחיבור הצליח. אם Meta לא תאפשר לחבר את המספר הקיים, נציע לך אפשרויות המשך — זו דרישה של Meta, לא תקלה ב־Allura.",
    recommendedBadge: "מומלץ לרוב העסקים",
  },
  {
    track: "personal",
    title: "יש לי WhatsApp רגיל/אישי",
    description:
      "מומלץ לא לחבר מספר אישי. עדיף לפתוח WhatsApp Business או להשתמש במספר עסקי ייעודי.",
    explanation:
      "חיבור מספר אישי שכבר רשום ב־WhatsApp עלול להיכשל או לחסום את המספר בתהליך החיבור. אם זה המספר היחיד שלך, עדיף קודם להעביר אותו ל־WhatsApp Business או להשתמש במספר עסקי ייעודי.",
    warning:
      "מספר אישי שכבר רשום ב־WhatsApp עלול להיחסם בתהליך החיבור.",
    ackWarning:
      "Meta עשויה לבקש לנתק או להעביר את המספר. מומלץ להשתמש במספר עסקי.",
  },
  {
    track: "new_number",
    title: "אין לי מספר עסקי / אני רוצה מספר חדש",
    description:
      "נפתח מספר עסקי חדש לעסק. המספר צריך להיות זמין לקבלת קוד אימות ולא להיות רשום כבר ב־WhatsApp.",
    explanation:
      "בחלון של Meta הזיני את המספר החדש. המספר יקבל קוד אימות מ־WhatsApp. ודאי שהמספר זמין לקבלת SMS או שיחה ושאינו רשום כבר ב־WhatsApp. בסיום תחזרי ל־Allura ונבדוק שהחיבור הצליח.",
  },
];

export function getTrackInfo(track: ConnectionTrack): ConnectionTrackInfo {
  return CONNECTION_TRACKS.find((t) => t.track === track) ?? CONNECTION_TRACKS[2];
}

/** Owner-facing Hebrew label for a stored connection source (confirmation card). */
export function connectionSourceLabel(source?: string | null): string {
  switch (source) {
    case "existing_business_app":
      return "WhatsApp Business קיים / חיבור משותף";
    case "personal":
      return "מספר אישי";
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
