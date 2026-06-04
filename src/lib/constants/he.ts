/**
 * מחרוזות טקסט בעברית לשימוש חוזר ברחבי הממשק.
 *
 * Beautiq הוא מוצר בעברית בלבד. כל טקסט שמוצג למשתמש צריך להישאב מכאן,
 * כדי למנוע שכפול של מחרוזות ולשמור על אחידות וניסוח נכון.
 *
 * מבנה: קבועים מקובצים לפי הקשר (מותג, ניווט, פעולות, מצבים).
 */

/** פרטי המותג */
export const BRAND = {
  name: "Beautiq",
  /** טאגליין קצר שמתאר את המוצר */
  tagline: "מערכת חכמה לניהול עסקי יופי וטיפוח",
} as const;

/** מטא-דאטה לעמודים (כותרת ותיאור) */
export const META = {
  title: "Beautiq — ניהול עסקי יופי וטיפוח",
  description:
    "Beautiq היא מערכת לניהול תורים, לקוחות ושירותים לעסקי יופי וטיפוח.",
} as const;

/** טקסטים של עמוד הבית הזמני */
export const HOME = {
  heading: "Beautiq",
  subheading: "המערכת בהכנה",
  body: "אנחנו בונים עבורך מערכת חכמה לניהול העסק. בקרוב כאן.",
} as const;

/** תוויות ניווט ראשי (סרגל הצד של האפליקציה) */
export const NAV = {
  dashboard: "לוח הבקרה",
  bookings: "תורים",
  clients: "לקוחות",
  services: "שירותים",
  availability: "שעות פעילות",
  messages: "הודעות",
  settings: "הגדרות",
} as const;

/** פעולות נפוצות (כפתורים) */
export const ACTIONS = {
  save: "שמירה",
  cancel: "ביטול",
  add: "הוספה",
  edit: "עריכה",
  delete: "מחיקה",
  confirm: "אישור",
  back: "חזרה",
  next: "הבא",
  send: "שליחה",
} as const;

/** מצבי ממשק כלליים (טעינה, ריק, שגיאה, הצלחה) */
export const STATES = {
  loading: "טוען…",
  empty: "אין כאן עדיין מידע להצגה",
  error: "אירעה שגיאה. נסו שוב",
  success: "הפעולה בוצעה בהצלחה",
} as const;

/** תוויות סטטוס לתורים (מיועד לשלבים הבאים, נשמר כאן לאחידות) */
export const BOOKING_STATUS = {
  pending: "ממתין לאישור",
  approved: "מאושר",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "הלקוחה לא הגיעה",
  rescheduled: "נדחה למועד אחר",
} as const;

/** טקסטים של מסכי אימות — התחברות והרשמה */
export const AUTH = {
  /** עמוד הרשמה */
  signup: {
    title: "יצירת חשבון",
    subtitle: "כמה פרטים קטנים ומתחילים",
    nameLabel: "שם מלא",
    namePlaceholder: "השם שלך",
    emailLabel: "אימייל",
    emailPlaceholder: "name@example.com",
    passwordLabel: "סיסמה",
    confirmPasswordLabel: "אישור סיסמה",
    submit: "יצירת חשבון",
    submitting: "יוצרים חשבון…",
    haveAccount: "כבר יש לך חשבון?",
    loginLink: "להתחברות",
  },
  /** עמוד התחברות */
  login: {
    title: "התחברות",
    subtitle: "טוב לראות אותך שוב",
    emailLabel: "אימייל",
    emailPlaceholder: "name@example.com",
    passwordLabel: "סיסמה",
    submit: "התחברות",
    submitting: "מתחברים…",
    noAccount: "אין לך עדיין חשבון?",
    signupLink: "ליצירת חשבון",
  },
  /** הודעות שגיאה והצלחה (אימות) */
  errors: {
    required: "יש למלא אימייל וסיסמה",
    nameRequired: "יש למלא שם מלא",
    emailRequired: "יש למלא אימייל",
    invalidEmail: "כתובת האימייל אינה תקינה",
    passwordRequired: "יש למלא סיסמה",
    passwordTooShort: "הסיסמה צריכה להכיל לפחות 8 תווים",
    confirmRequired: "יש לאמת את הסיסמה",
    passwordsMismatch: "הסיסמאות אינן תואמות",
    emailTaken: "קיים כבר חשבון עם האימייל הזה",
    invalidCredentials: "האימייל או הסיסמה אינם תקינים",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
  success: {
    accountCreated: "החשבון נוצר בהצלחה",
  },
} as const;

/** טקסטים של לוח הבקרה והגדרת העסק בתוך האפליקציה */
export const DASHBOARD = {
  signOut: "התנתקות",
  /** ברכת פתיחה כללית (כותרת אזור התוכן) */
  greeting: "שלום",

  /** מצב א׳ — משתמש מחובר שעדיין אין לו עסק: כרטיס הקמת העסק */
  setup: {
    title: "ברוכים הבאים ל־Beautiq",
    subtitle: "עוד כמה פרטים קטנים והכול מוכן",
    body: "כדי להתחיל להשתמש במערכת, ניצור קודם את העסק שלך. זה לוקח פחות מדקה.",
    nameLabel: "שם העסק",
    namePlaceholder: "לדוגמה: הסטודיו של דנה",
    slugLabel: "כתובת אישית לעסק",
    slugHelp: "זו תהיה הכתובת שתוכלו לשלוח ללקוחות בהמשך",
    submit: "יצירת העסק והמשך",
  },

  /** מצב ב׳ — לעסק יש כבר רשומה: רשימת צעדים מומלצים להמשך הגדרה */
  checklist: {
    title: "העסק שלך נוצר בהצלחה",
    subtitle: "עוד כמה צעדים קטנים והמערכת תהיה מוכנה לעבודה",
    soon: "בקרוב",
    items: {
      categories: "להוסיף תחומי פעילות",
      service: "להוסיף שירות ראשון",
      availability: "להגדיר שעות פעילות",
      profile: "להשלים פרטי עסק",
      publicLink: "לצפות בקישור הציבורי",
    },
  },
} as const;

/**
 * טקסטים סביב הקמת העסק (שגיאות אימות). תהליך ההקמה עצמו מתבצע כעת
 * בתוך לוח הבקרה ולא באשף נפרד.
 */
export const ONBOARDING = {
  errors: {
    nameRequired: "יש למלא שם עסק",
    slugRequired: "יש לבחור כתובת אישית לעסק",
    slugInvalid: "הכתובת האישית יכולה להכיל אותיות באנגלית, מספרים ומקפים בלבד",
    slugTaken: "הכתובת האישית כבר תפוסה",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לעמודים שטרם מומשו (מצבי ריק ידידותיים) */
export const PLACEHOLDERS = {
  default: "העמוד הזה ייפתח בשלב הבא",
  bookings: { title: NAV.bookings, message: "בקרוב נוסיף כאן את ניהול התורים" },
  clients: { title: NAV.clients, message: "בקרוב נוסיף כאן את רשימת הלקוחות" },
  services: { title: NAV.services, message: "בקרוב נוסיף כאן את ניהול השירותים" },
  availability: {
    title: NAV.availability,
    message: "בקרוב נוסיף כאן את שעות הפעילות",
  },
  messages: { title: NAV.messages, message: "בקרוב נוסיף כאן את ההודעות ללקוחות" },
  settings: { title: NAV.settings, message: "בקרוב נוסיף כאן את הגדרות העסק" },
} as const;
