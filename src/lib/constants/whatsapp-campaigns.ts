/**
 * Hebrew copy for the bulk WhatsApp campaign feature (owner-facing).
 *
 * Owner screens never expose Meta terminology (Phone Number ID, WABA, tokens) —
 * only clear Hebrew. Technical identifiers appear only in admin diagnostics.
 */

export const WA_CAMPAIGNS = {
  // Entry points
  bulkAction: "שליחת WhatsApp ללקוחות",
  singleAction: "שליחת WhatsApp",
  historyTitle: "קמפיינים שנשלחו",
  historyEmpty: "עדיין לא נשלחו קמפיינים",

  // Steps
  steps: {
    audience: "בחירת קהל",
    content: "תוכן ההודעה",
    confirm: "אישור ושליחה",
    progress: "מעקב שליחה",
  },

  // Audience
  audience: {
    title: "למי לשלוח?",
    allEligible: "כל הלקוחות הזכאים",
    manual: "בחירת לקוחות ידנית",
    filterVisited: "לקוחות שביקרו בתקופה האחרונה",
    filterNotReturned: "לקוחות שלא חזרו",
    filterFutureBooking: "לקוחות עם תור עתידי",
    filterNoFutureBooking: "לקוחות ללא תור עתידי",
    searchPlaceholder: "חיפוש לפי שם או טלפון",
    eligibleCount: "זכאים לשליחה",
    excludedCount: "לא יישלחו",
    selectedCount: "סך הכול שנבחרו",
    viewExcluded: "צפייה בלקוחות שלא יקבלו הודעה",
    noEligible: "אין כרגע לקוחות זכאים לשליחת קמפיין שיווקי",
  },

  // Exclusion reasons (owner-facing)
  reasons: {
    invalid_phone: "חסר מספר טלפון תקין",
    unsubscribed: "הלקוחה הסירה את עצמה מהודעות",
    duplicate_phone: "המספר מופיע יותר מפעם אחת",
    missing_template_data: "חסרים נתונים לתבנית ההודעה",
    blocked: "לא ניתן לשלוח ללקוחה זו",
  },

  // Template / content
  content: {
    title: "תבנית ההודעה",
    templateLabel: "תבנית מאושרת",
    previewTitle: "תצוגה מקדימה",
    exampleForClient: "דוגמה עבור",
    unavailableWarning:
      "התבנית השיווקית עדיין לא אושרה על ידי WhatsApp. לא ניתן לשלוח קמפיין עד לאישור התבנית.",
    pendingWarning: "התבנית ממתינה לאישור WhatsApp.",
    recipientsFinal: "נמענים בפועל",
    neutralNote:
      "התבנית השיווקית המאושרת היא הודעת חזרה עדינה. אין צורך להזין טקסט — ההודעה תישלח כפי שמופיעה בתצוגה המקדימה.",
  },

  // Confirmation
  confirm: {
    title: "אישור שליחה",
    template: "תבנית",
    eligible: "נמענים זכאים",
    excluded: "לא יישלחו",
    estimated: "צפי שליחות",
    warning: "ההודעה תישלח לכל הלקוחות הזכאים ברשימה.",
    checkbox: (n: number) =>
      `אני מאשרת לשלוח את ההודעה ל־${n} לקוחות הזכאים לקבל הודעות WhatsApp`,
    sendButton: (n: number) => `שליחה ל־${n} לקוחות`,
    sending: "שולח…",
  },

  // Progress / history
  progress: {
    title: "מעקב שליחה",
    accepted: "התקבל ב־Meta",
    sent: "נשלח",
    delivered: "נמסר",
    read: "נקרא",
    failed: "נכשל",
    skipped: "דולג",
    queued: "ממתין לשליחה",
    done: "השליחה הושלמה",
    inProgress: "השליחה מתבצעת…",
    retryFailed: "שליחה חוזרת לנכשלים",
    cancel: "ביטול הקמפיין",
    createdBy: "נוצר על ידי",
    createdAt: "תאריך יצירה",
    audience: "קהל",
    viewDetails: "צפייה בפרטים",
  },

  // Campaign statuses (owner-facing)
  status: {
    draft: "טיוטה",
    queued: "ממתין לשליחה",
    processing: "בתהליך",
    completed: "הושלם",
    completed_with_errors: "הושלם עם שגיאות",
    cancelled: "בוטל",
  },

  // Recipient statuses (owner-facing)
  recipientStatus: {
    queued: "ממתין",
    processing: "בתהליך",
    accepted: "התקבל ב־Meta",
    sent: "נשלח",
    delivered: "נמסר",
    read: "נקרא",
    failed: "נכשל",
    skipped: "דולג",
  },

  errors: {
    templateUnavailable:
      "אין תבנית שיווקית מאושרת. יש להגדיר ולאשר תבנית WhatsApp שיווקית לפני שליחת קמפיין.",
    noEligible: "אין לקוחות זכאים לשליחה.",
    notFound: "הקמפיין לא נמצא.",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע.",
    notConnected: "WhatsApp לא מחובר לעסק הזה.",
  },
} as const;
