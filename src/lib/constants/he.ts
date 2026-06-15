/**
 * מחרוזות טקסט בעברית לשימוש חוזר ברחבי הממשק.
 *
 * Allura הוא מוצר בעברית בלבד. כל טקסט שמוצג למשתמש צריך להישאב מכאן,
 * כדי למנוע שכפול של מחרוזות ולשמור על אחידות וניסוח נכון.
 *
 * מבנה: קבועים מקובצים לפי הקשר (מותג, ניווט, פעולות, מצבים).
 */

/** פרטי המותג */
export const BRAND = {
  name: "Allura",
  /** טאגליין קצר שמתאר את המוצר */
  tagline: "מערכת חכמה לניהול עסקי יופי וטיפוח",
} as const;

/** מטא-דאטה לעמודים (כותרת ותיאור) */
export const META = {
  title: "Allura — ניהול עסקי יופי וטיפוח",
  description:
    "Allura היא מערכת לניהול תורים, לקוחות ושירותים לעסקי יופי וטיפוח.",
} as const;

/** טקסטים של עמוד הבית */
export const HOME = {
  heading: "Allura",
  tagline: "המערכת לניהול עסקי יופי וטיפוח",
  body: "נהלי תורים, לקוחות ושירותים — הכול במקום אחד, בפשטות.",
} as const;

/** תוויות ניווט ראשי (סרגל הצד של האפליקציה) */
export const NAV = {
  dashboard: "לוח הבקרה",
  bookings: "תורים",
  clients: "לקוחות",
  services: "שירותים",
  availability: "שעות פעילות",
  // New primary nav
  bringBack: "החזרת לקוחות",
  automations: "אוטומציות",
  finance: "כספים",
  publicPage: "עמוד לקוחות",
  settings: "הגדרות",
  // Legacy routes — kept accessible but no longer in sidebar
  messages: "הודעות",
  retention: "שימור לקוחות",
  reputation: "מוניטין",
  pricing: "תובנות מחיר",
  atRisk: "לקוחות בסיכון",
  winBack: "קמפיינים להחזרה",
  revenueForecast: "תחזית הכנסות",
  plans: "חבילות פרימיום",
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
  greeting: "שלום",
  /** כותרת משנה בכותרת האפליקציה */
  headerSubtitle: "המערכת שלך לניהול תורים ולקוחות",
  /** כותרת כאשר עדיין אין עסק */
  headerNoBusinessTitle: "הגדרת העסק שלך",

  /** מצב א׳ — משתמש מחובר שעדיין אין לו עסק: כרטיס הקמת העסק */
  setup: {
    title: "ברוכים הבאים ל־Allura",
    subtitle: "עוד רגע והמערכת שלך מוכנה",
    body: "כדי להתחיל, צריך רק את שם העסק. את שאר הפרטים אפשר להשלים אחר כך בקצב שלך.",
    nameLabel: "שם העסק",
    namePlaceholder: "לדוגמה: הסטודיו של דנה",
    submit: "יצירת העסק שלי",
  },

  /** מצב ב׳ — העסק קיים: לוח בקרה מלא */
  welcome: {
    badge: "הגדרת העסק",
    titlePrefix: "ברוכים הבאים,",
    subtitle:
      "עכשיו נשלים כמה דברים קטנים כדי שתוכלו להתחיל לקבל תורים בצורה מסודרת.",
    note: "זה ייקח כמה דקות, ואפשר להשלים הכול בהדרגה.",
  },

  /** כרטיסי מדדים */
  metrics: {
    bookingsToday: "תורים להיום",
    bookingsTodayHint: "אין תורים להיום",
    clients: "לקוחות",
    clientsHint: "לקוחות שנשמרו במערכת",
    clientsEmpty: "לקוחות יתווספו אוטומטית כשנוצרים תורים",
    services: "שירותים",
    servicesHint: "שירותים פעילים במערכת",
    servicesEmpty: "בקרוב נוסיף כאן את השירותים שלך",
    monthRevenue: "הכנסות החודש",
    monthRevenueHint: "מחושב מתורים שהושלמו החודש",
  },

  /** כרטיס התקדמות הגדרת העסק */
  progress: {
    title: "הגדרת העסק",
    completedOf: "הושלמו מתוך",
    soon: "בקרוב",
    items: {
      categories: "להוסיף תחומי פעילות",
      service: "להוסיף שירות ראשון",
      availability: "להגדיר שעות פעילות",
      profile: "להשלים פרטי עסק",
      publicLink: "להכין קישור הזמנה פשוט",
    },
  },

  /** כרטיס הנחיה חכמה — גוף הטקסט ו-CTA משתנים לפי מצב ההגדרה */
  guidance: {
    title: "מה כדאי לעשות עכשיו?",
    bodyNoService:
      "השלב הבא הוא להוסיף את השירות הראשון שלך — לדוגמה לק ג׳ל, עיצוב גבות, טיפול פנים או כל שירות אחר שהעסק מציע.",
    bodyNoAvailability:
      "עכשיו כדאי להגדיר באילו ימים ושעות העסק פתוח לקבלת תורים.",
    bodyNoBookings:
      "אפשר להתחיל ליצור תור ראשון ולנהל את היומן מתוך המערכת.",
    bodyAllDone:
      "המערכת כבר פעילה. אפשר להמשיך לנהל תורים, לקוחות ושירותים מתוך לוח הבקרה.",
    ctaFirstService: "להוסיף שירות ראשון",
    ctaAvailability: "להגדיר שעות פעילות",
    ctaFirstBooking: "יצירת תור ראשון",
    ctaViewBookings: "צפייה בתורים",
  },

  /** סקשן תורים קרובים */
  upcoming: {
    title: "תורים קרובים",
    empty: "אין תורים קרובים כרגע",
    today: "היום",
    tomorrow: "מחר",
  },
} as const;

/**
 * טקסטים סביב הקמת העסק (שגיאות אימות). תהליך ההקמה עצמו מתבצע כעת
 * בתוך לוח הבקרה ולא באשף נפרד.
 */
export const ONBOARDING = {
  errors: {
    nameRequired: "יש למלא שם עסק",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לניהול שירותים */
export const SERVICES = {
  pageTitle: "שירותים",
  pageSubtitle: "כאן מגדירים את השירותים שהלקוחות יוכלו להזמין בהמשך",
  addButton: "הוספת שירות",

  emptyState: {
    title: "השירותים שלך יופיעו כאן",
    body: "כדי להתחיל לקבל תורים, צריך להוסיף לפחות שירות אחד — למשל לק ג׳ל, עיצוב גבות, טיפול פנים או כל שירות אחר שהעסק מציע.",
    cta: "הוספת שירות ראשון",
  },

  form: {
    createTitle: "שירות חדש",
    editTitle: "עריכת שירות",
    saveButton: "שמירת שירות",
    saveEditButton: "שמירת שינויים",
    saving: "שומר…",
    backLink: "חזרה לשירותים",

    sectionBasic: "פרטי השירות",
    sectionPriceAndTime: "מחיר וזמן",
    sectionAdvanced: "אפשרויות מתקדמות",
    advancedOptional: "אופציונלי",

    nameLabel: "שם השירות",
    namePlaceholder: "לדוגמה: לק ג׳ל",
    descriptionLabel: "תיאור קצר",
    descriptionPlaceholder: "מה כולל השירות?",

    durationLabel: "משך הטיפול",
    durationHint: "כמה זמן השירות נמשך בפועל",
    durationPlaceholder: "בחירה…",

    priceLabel: "מחיר",
    pricePlaceholder: "לדוגמה: 180",

    bufferBeforeLabel: "זמן הכנה לפני השירות",
    bufferBeforeHint: "לדוגמה: 10 דקות להכנת העמדה",
    bufferAfterLabel: "זמן התארגנות אחרי השירות",
    bufferAfterHint: "לדוגמה: 10 דקות לניקוי או התארגנות",

    categoryLabel: "תחום פעילות",
    categoryPlaceholder: "ללא בחירה",
    categoryHint: "אפשר להשאיר ריק ולשייך בהמשך",

    isActiveLabel: "שירות פעיל",
  },

  card: {
    duration: "משך טיפול",
    price: "מחיר",
    active: "פעיל",
    inactive: "כבוי",
    editButton: "עריכה",
    activateSuccess: "השירות הופעל",
    deactivateSuccess: "השירות כובה",
    toggleError: "לא הצלחנו לעדכן את השירות. נסו שוב.",
  },

  errors: {
    nameRequired: "יש למלא שם שירות",
    durationRequired: "יש לבחור משך טיפול",
    durationInvalid: "משך הטיפול אינו תקין",
    priceRequired: "יש למלא מחיר",
    priceInvalid: "המחיר אינו תקין",
    bufferInvalid: "הזמן אינו תקין",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
    notFound: "השירות לא נמצא",
  },

  categories: {
    nails: "ציפורניים",
    brows: "גבות",
    lashes: "ריסים",
    hair: "שיער",
    makeup: "איפור",
    cosmetics: "קוסמטיקה",
    laser: "לייזר",
    aesthetics: "אסתטיקה",
    massage: "עיסוי",
    spa: "ספא",
    permanent_makeup: "איפור קבוע",
    other: "אחר",
  },
} as const;

/** טקסטים לניהול שעות פעילות */
export const AVAILABILITY = {
  pageTitle: "שעות פעילות",
  pageSubtitle: "כאן מגדירים מתי העסק פתוח לקבלת תורים",

  emptyState: {
    title: "נגדיר מתי העסק פתוח לתורים",
    body: "בחרו את הימים והשעות שבהם אפשר לקבוע תורים. תמיד אפשר לשנות את זה בהמשך.",
    cta: "הגדרת שעות פעילות",
  },

  weekly: {
    title: "שעות עבודה שבועיות",
    subtitle: "קבעו באילו ימים ושעות העסק פתוח",
    saveButton: "שמירת שעות פעילות",
    saving: "שומר…",
    success: "שעות הפעילות נשמרו בהצלחה",
    open: "פתוח",
    closed: "סגור",
    startTime: "משעה",
    endTime: "עד שעה",
    closedDayNote: "לא מקבלים תורים ביום הזה",
    unsavedChanges: "יש שינויים שלא נשמרו",
    presets: {
      hint: "אפשר להתחיל מתבנית מוכנה ולשנות לפי הצורך",
      sunThu9to17: "רגיל 09:00–17:00",
      sunThu10to19: "ערב 10:00–19:00",
      withFriday: "כולל שישי",
      clearAll: "ניקוי",
    },
    summary: {
      heading: "סיכום שעות הפעילות",
      empty: "עדיין לא הוגדרו שעות פעילות",
    },
  },

  days: {
    0: "ראשון",
    1: "שני",
    2: "שלישי",
    3: "רביעי",
    4: "חמישי",
    5: "שישי",
    6: "שבת",
  } as Record<number, string>,

  exceptions: {
    title: "תאריכים מיוחדים",
    subtitle: "סמנו ימים סגורים או שעות שונות לתאריכים ספציפיים",
    addTitle: "הוספת תאריך מיוחד",
    addButton: "הוספת תאריך מיוחד",
    adding: "מוסיף…",
    noExceptions: "אין תאריכים מיוחדים כרגע",
    dateLabel: "תאריך",
    dateHint: "יש לבחור תאריך",
    typeLabel: "סוג חריגה",
    reasonLabel: "סיבה / הערה",
    reasonOptional: "אופציונלי",
    reasonPlaceholder: "לדוגמה: חג, חופשה, טיפול מיוחד",
    startTime: "משעה",
    endTime: "עד שעה",
    deleteButton: "מחיקה",
    typeClosed: "יום סגור",
    typeCustomHours: "שעות מיוחדות",
    addSuccess: "החריגה נוספה בהצלחה",
    deleteConfirm: "למחוק את החריגה?",
  },

  errors: {
    startRequired: "יש לבחור שעת התחלה",
    endRequired: "יש לבחור שעת סיום",
    endBeforeStart: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    invalidTime: "השעה אינה תקינה",
    dateRequired: "יש לבחור תאריך",
    typeRequired: "יש לבחור סוג חריגה",
    dateTaken: "כבר קיימת חריגה לתאריך זה",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לניהול תורים */
export const BOOKINGS = {
  pageTitle: "תורים",
  pageSubtitle: "כאן מנהלים את התורים של העסק",
  addButton: "תור חדש",

  emptyState: {
    title: "עדיין אין תורים",
    body: "כאן יופיעו כל התורים של העסק. אפשר להתחיל מתור ידני עבור לקוחה קיימת או חדשה.",
    cta: "יצירת תור ראשון",
  },

  summary: {
    today: "תורים היום",
    week: "תורים השבוע",
    pending: "ממתינים לאישור",
    cancelled: "בוטלו / לא הגיעו",
  },

  filters: {
    today: "היום",
    week: "השבוע",
    all: "הכל",
  },

  statusFilters: {
    all: "כל הסטטוסים",
    active: "פעילים",
    completed: "הושלמו",
    cancelled: "בוטלו",
  },

  createdSuccess: "התור נוצר בהצלחה",

  form: {
    createTitle: "תור חדש",
    saveButton: "שמירת תור",
    saving: "שומר…",
    backLink: "חזרה לתורים",

    sectionClient: "פרטי הלקוחה",
    sectionService: "בחירת שירות",
    sectionDateTime: "תאריך ושעה",
    sectionNotes: "הערות פנימיות",

    clientNameLabel: "שם הלקוחה",
    clientNamePlaceholder: "לדוגמה: נועה כהן",
    phoneLabel: "טלפון",
    phonePlaceholder: "050-0000000",
    clientPhoneHelper:
      "אם הלקוחה כבר קיימת, המערכת תזהה אותה לפי מספר הטלפון",

    serviceLabel: "שירות",
    servicePlaceholder: "בחירת שירות…",
    serviceNoActive: "לפני יצירת תור צריך להוסיף לפחות שירות אחד.",
    serviceNoActiveCta: "הוספת שירות",
    serviceDuration: "דק׳",
    servicePrice: "₪",
    serviceSummaryDuration: "משך טיפול",
    serviceSummaryPrice: "מחיר",

    dateLabel: "תאריך",
    startTimeLabel: "שעה",
    startTimePlaceholder: "בחירת שעה…",
    overlapHelper: "מוצגות רק השעות הפנויות לשירות שנבחר",
    loadingSlots: "טוען שעות פנויות…",
    noSlots: "אין שעות פנויות ביום הזה",
  },

  card: {
    minutesShort: "דק׳",
    price: "₪",
    viewEdit: "צפייה / עריכה",
    viewDetails: "פרטים",
    quickApprove: "אישור",
    quickComplete: "הושלם",
    quickCancel: "ביטול",
    quickNoShow: "לא הגיעה",
  },

  detail: {
    title: "פרטי תור",
    backLink: "חזרה לתורים",
    clientName: "שם הלקוחה",
    phone: "טלפון",
    service: "שירות",
    dateTime: "תאריך ושעה",
    duration: "משך",
    price: "מחיר",
    status: "סטטוס",
    notes: "הערות פנימיות",
    noNotes: "אין הערות",
    createdAt: "נוצר ב־",
    sourcePublic: "מקור: קישור הזמנה",
    notesLabel: "הערות פנימיות",
    notesPlaceholder: "דברים שחשוב לזכור לגבי התור",
    saveNotes: "שמירת הערות",
    savingNotes: "שומר…",
    notesSaved: "ההערות נשמרו",
    contactSection: "פרטי קשר",
  },

  actions: {
    sectionTitle: "פעולות",
    approve: "אישור תור",
    complete: "סימון כהושלם",
    cancel: "ביטול תור",
    noShow: "הלקוחה לא הגיעה",
    approving: "מאשר…",
    completing: "מסמן…",
    cancelling: "מבטל…",
    markingNoShow: "מסמן…",
    successComplete: "התור סומן כהושלם",
    successCancel: "התור בוטל",
    successNoShow: "התור סומן כלא הגיעה",
    successApprove: "התור אושר",
  },

  lateCancellation: {
    badgeLate: "ביטול מאוחר",
    badgeOnTime: "בוטל בזמן",
    feeLabel: "דמי ביטול",
    feeStatusPending: "ממתין לגבייה",
    feeStatusPaid: "שולמו",
    markFeeRequired: "סימון דמי ביטול כנדרשים",
    markFeePaid: "סימון כשולמו",
    markingFee: "מסמן…",
    feeMarkedRequired: "דמי הביטול סומנו כנדרשים",
    feeMarkedPaid: "דמי הביטול סומנו כשולמו",
    manualNote: "גבייה אוטומטית של דמי ביטול תתווסף בהמשך. ניתן לעקוב ולסמן ידנית.",
    dashboardCard: {
      title: "ביטולים מאוחרים",
      bodySingular: "ביטול מאוחר אחד השבוע",
      bodyPlural: (count: number) => `${count} ביטולים מאוחרים השבוע`,
      cta: "צפייה בתורים",
    },
  },

  errors: {
    clientNameRequired: "יש למלא שם לקוחה",
    phoneRequired: "יש למלא מספר טלפון",
    phoneInvalid: "מספר הטלפון לא נראה תקין",
    serviceRequired: "יש לבחור שירות",
    serviceUnavailable: "השירות שנבחר אינו זמין",
    dateRequired: "יש לבחור תאריך",
    startTimeRequired: "יש לבחור שעה",
    pastBooking: "לא ניתן לקבוע תור בזמן שכבר עבר",
    overlap: "כבר קיים תור בשעה הזו",
    notFound: "התור לא נמצא",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לניהול לקוחות (CRM) */
export const CLIENTS = {
  pageTitle: "לקוחות",
  pageSubtitle: "כאן מנהלים את הלקוחות והיסטוריית התורים שלהם",

  summary: {
    total: "סך לקוחות",
    totalHelper: "כל הלקוחות שנשמרו במערכת",
    withUpcoming: "עם תור עתידי",
    withUpcomingHelper: "לקוחות שכבר קבעו תור קדימה",
    withNoShow: "לא הגיעו",
    withNoShowHelper: "לקוחות שסומנו כלא הגיעו",
    notReturned: "לא חזרו",
    notReturnedHelper: "לקוחות שלא קבעו תור תקופה ארוכה",
  },

  search: {
    placeholder: "חיפוש לפי שם או טלפון",
    button: "חיפוש",
  },

  emptyState: {
    title: "עדיין אין לקוחות",
    body: "לקוחות יתווספו אוטומטית כשתיצרו תורים במערכת.",
    cta: "יצירת תור ראשון",
  },

  searchEmpty: {
    title: "לא נמצאו לקוחות",
    body: "אפשר לבדוק את האיות או לחפש לפי מספר טלפון.",
    showAll: "הצגת כל הלקוחות",
  },

  card: {
    lastVisit: "ביקור אחרון",
    upcomingBooking: "תור קרוב",
    totalBookings: "תורים",
    noShow: "לא הגיעו",
    cancellations: "ביטולים",
    totalSpent: "הוצאה",
    detailsButton: "פרטים",
    newBookingButton: "תור חדש",
    noVisitYet: "טרם ביקרה",
  },

  detail: {
    backLink: "חזרה ללקוחות",
    profileSection: "פרטי לקוחה",
    totalSpent: "סה״כ הוצאה",
    totalBookings: "סה״כ תורים",
    completedBookings: "טיפולים שהושלמו",
    noShowCount: "לא הגיעו",
    cancellationCount: "ביטולים",
    lastVisit: "ביקור אחרון",
    upcomingBooking: "תור קרוב",
    noVisitYet: "טרם ביקרה",
    noUpcoming: "אין תור עתידי",

    statusActive: "לקוחה פעילה",
    statusHasNoShow: "לא הגיעה בעבר",
    statusNotReturned: "לא חזרה לאחרונה",
    statusNew: "לקוחה חדשה",
    newBookingButton: "תור חדש ללקוחה",

    contactSection: "פרטי קשר",
    name: "שם",
    phone: "טלפון",
    email: "אימייל",
    noEmail: "לא צוין",
    memberSince: "לקוחה מאז",

    notesSection: "הערות פנימיות",
    notesHelper:
      "כאן אפשר לשמור דברים חשובים על הלקוחה — אלרגיות, העדפות, מידע חשוב או הערות לטיפול הבא.",
    notesPlaceholder: "הערות על הלקוחה — אלרגיות, העדפות, מידע חשוב",
    saveNotes: "שמירת הערות",
    savingNotes: "שומר…",
    notesSaved: "ההערות נשמרו",

    historySection: "היסטוריית תורים",
    noBookings: "אין תורים קודמים",
    noBookingsTitle: "אין עדיין היסטוריית תורים",
    noBookingsBody: "אחרי שייקבעו תורים ללקוחה, הם יופיעו כאן.",
    noBookingsCta: "יצירת תור ללקוחה",
    viewBooking: "פרטים",

    insightsSection: "תובנות לקוחה",
    insightNoBookings: "אין תורים קודמים",
    insightHasUpcoming: "יש תור עתידי",
    insightHasNoShow: "הלקוחה לא הגיעה בעבר",
    insightHasCancellations: "הלקוחה ביטלה תורים בעבר",
    insightNotReturned: "הלקוחה לא חזרה לאחרונה",

    optInSection: "הסכמה לקבלת הודעות",
    optInHelper:
      "הודעות WhatsApp נשלחות רק ללקוחות שאישרו זאת. הודעות שיווקיות (כמו הודעות החזרת לקוחה) דורשות הסכמה נפרדת.",
    whatsappOptInLabel: "אישרה קבלת הודעות WhatsApp",
    marketingOptInLabel: "אישרה קבלת הודעות שיווקיות (החזרת לקוחה, מבצעים)",
    optInSave: "שמירה",
    optInSaving: "שומר…",
    optInSaved: "העדפות ההודעות עודכנו",
    optInError: "שמירה נכשלה",
  },

  edit: {
    openButton: "עריכת פרטי לקוחה",
    title: "עריכת פרטי לקוחה",
    saveButton: "שמירת שינויים",
    savingButton: "שומר…",
    cancelButton: "ביטול",
    savedSuccess: "פרטי הלקוחה עודכנו",

    fields: {
      fullName: "שם לקוחה",
      phone: "טלפון",
      phonePlaceholder: "0501234567",
      email: "אימייל",
      emailPlaceholder: "example@email.com",
      notes: "הערות פנימיות",
      notesPlaceholder: "הערות על הלקוחה — אלרגיות, העדפות, מידע חשוב",
      whatsappOptIn: "מאשרת קבלת הודעות WhatsApp",
      marketingOptIn: "מאשרת הודעות שיווקיות (החזרת לקוחה, מבצעים)",
      unsubscribedNotice: "הלקוחה הסירה את עצמה מהודעות אוטומטיות",
    },

    errors: {
      nameRequired: "יש למלא את שם הלקוחה",
      phoneRequired: "יש למלא מספר טלפון",
      phoneInvalid: "מספר הטלפון לא תקין",
      phoneDuplicate: "כבר קיימת לקוחה עם מספר הטלפון הזה",
    },
  },

  errors: {
    notFound: "הלקוחה לא נמצאה",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לניהול הודעות וואטסאפ */
export const MESSAGES = {
  pageTitle: "הודעות",
  pageSubtitle:
    "הכינו הודעות מוכנות ללקוחות לפי תורים ומצבים נפוצים",
  explanation:
    "ההודעות לא נשלחות אוטומטית. Allura מכינה ניסוח מוכן, ואתם מעתיקים ושולחים בוואטסאפ.",
  templatesTitle: "תבניות קיימות",
  noTemplates: "אין תבניות זמינות כרגע",
  tipTitle: "איך משתמשים?",
  tipBody:
    "בדף פרטי התור ובפרופיל הלקוחה יש כפתורי העתקה שמכינים את ההודעה המותאמת אישית — עם שם הלקוחה, שם השירות, תאריך ושעה.",
  bookingMessagesSection: "הודעות וואטסאפ",
  clientMessagesSection: "הודעות מהירות",
  copySuccess: "ההודעה הועתקה",
  copyFallbackNote: "לא הצלחנו להעתיק אוטומטית. אפשר להעתיק ידנית:",
  smartComposer: {
    sectionTitle: "יצירת הודעה חכמה",
    sectionSubtitle: "בחרו מצב, והמערכת תכין הודעה מוכנה לשליחה.",
    scenarioLabel: "מצב",
    bookingLabel: "תור",
    bookingPlaceholder: "בחרו תור לפרסונליזציה (אופציונלי)",
    noBookingsAvailable: "אין תורים זמינים להצגה כרגע.",
    clientLabel: "לקוחה",
    clientPlaceholder: "בחרו לקוחה לפרסונליזציה (אופציונלי)",
    noClientsAvailable: "אין לקוחות זמינים כרגע.",
    previewTitle: "תצוגת הודעה",
    copyButton: "העתקת הודעה",
    resetButton: "איפוס",
    toneLabel: "סגנון",
    tones: {
      regular: "רגיל",
      warm: "חם יותר",
      concise: "קצר וישיר",
    } as Record<string, string>,
    scenarios: {
      booking_confirmation: "אישור תור",
      booking_reminder: "תזכורת לתור",
      booking_cancelled: "ביטול תור",
      booking_rescheduled: "שינוי מועד",
      after_treatment: "הודעה אחרי טיפול",
      rebook_reminder: "קביעת תור חוזר",
      no_show_followup: "לקוחה שלא הגיעה",
      not_returned: "לקוחה שלא חזרה",
    },
    noScenarioSelected: "בחרו מצב להתחיל",
  },
  copyLabels: {
    booking_confirmation: "העתקת אישור תור",
    booking_reminder: "העתקת תזכורת לתור",
    booking_cancelled: "העתקת הודעת ביטול",
    after_treatment: "העתקת הודעה אחרי טיפול",
    rebook_reminder: "הודעה לקביעת תור חוזר",
    after_treatment_client: "הודעה אחרי טיפול",
  },
  templateTypeLabels: {
    booking_confirmation: "אישור תור",
    booking_reminder: "תזכורת לתור",
    booking_cancelled: "ביטול תור",
    booking_rescheduled: "שינוי מועד",
    after_treatment: "אחרי טיפול",
    rebook_reminder: "תזכורת לקביעת תור חוזר",
    empty_slot_offer: "הצעת חלון פנוי",
    waitlist_offer: "הצעה מרשימת המתנה",
  },
  templateUseCases: {
    booking_confirmation: "מתאים לשליחה אחרי קביעת תור",
    booking_reminder: "מתאים לשליחה יום לפני התור",
    booking_cancelled: "מתאים לשליחה אחרי ביטול תור",
    booking_rescheduled: "מתאים לשליחה אחרי שינוי מועד",
    after_treatment: "מתאים לשליחה אחרי הטיפול",
    rebook_reminder: "מתאים ללקוחות שלא חזרו זמן רב",
    empty_slot_offer: "מתאים כשמתפנה חלון בלו״ז",
    waitlist_offer: "מתאים ללקוחות ברשימת המתנה",
  },
  templateVariableLabels: {
    clientName: "שם לקוחה",
    businessName: "שם העסק",
    serviceName: "שם השירות",
    bookingDate: "תאריך התור",
    bookingTime: "שעת התור",
    price: "מחיר",
  },
  templateVariablesHint: "משתנים:",
} as const;

/** טקסטים לסקשן ההנחיות העסקיות בלוח הבקרה */
export const GUIDANCE = {
  sectionTitle: "מה דורש תשומת לב?",
  allClear: {
    title: "הכול נראה מסודר",
    body: "אין כרגע דברים דחופים שדורשים טיפול. אפשר להמשיך לנהל תורים, לקוחות ושירותים מתוך לוח הבקרה.",
  },
  priority: {
    important: "חשוב",
    recommended: "מומלץ",
    info: "לידיעה",
  },
  rules: {
    noServices: {
      title: "עדיין לא הוגדרו שירותים",
      body: "כדי להתחיל לנהל תורים בצורה מסודרת, כדאי להוסיף לפחות שירות אחד.",
      action: "הוספת שירות",
    },
    noAvailability: {
      title: "עדיין לא הוגדרו שעות פעילות",
      body: "כדי לדעת מתי אפשר לקבוע תורים, כדאי להגדיר את שעות הפעילות של העסק.",
      action: "הגדרת שעות פעילות",
    },
    todayBookings: {
      title: "יש תורים להיום",
      body: "כדאי לעבור על התורים של היום ולוודא שהכול מוכן.",
      action: "צפייה בתורים",
    },
    pendingBookings: {
      title: "יש תורים שממתינים לאישור",
      body: "כדאי לאשר או לבטל תורים שממתינים כדי לשמור על יומן מסודר.",
      action: "צפייה בתורים",
    },
    clientsNotReturned: {
      title: "יש לקוחות שלא חזרו לאחרונה",
      body: "אפשר לשלוח הודעה קצרה ולהציע לקבוע תור נוסף.",
      action: "צפייה בלקוחות",
    },
    noShowClients: {
      title: "יש לקוחות עם היסטוריית אי־הגעה",
      body: "כדאי לשים לב ללקוחות שלא הגיעו בעבר ולעקוב אחריהם בתורים הבאים.",
      action: "צפייה בלקוחות",
    },
    noUpcomingBookings: {
      title: "אין תורים קרובים",
      body: "המערכת מוכנה, אבל כרגע אין תורים קרובים. אפשר ליצור תור ידני או לשלוח הודעה ללקוחות חוזרות.",
      action: "יצירת תור",
    },
  },
} as const;

/** טקסטים לעמוד הגדרות העסק */
export const SETTINGS = {
  pageTitle: "הגדרות",
  pageSubtitle: "כאן מעדכנים את פרטי העסק והעדפות בסיסיות",

  businessDetails: {
    sectionTitle: "פרטי העסק",
    nameLabel: "שם העסק",
    namePlaceholder: "לדוגמה: הסטודיו של יעל",
    phoneLabel: "טלפון העסק",
    phonePlaceholder: "050-0000000",
    cityLabel: "עיר / אזור פעילות",
    cityPlaceholder: "לדוגמה: פתח תקווה",
    descriptionLabel: "תיאור קצר",
    descriptionPlaceholder: "לדוגמה: סטודיו לטיפולי יופי וטיפוח באווירה אישית",
    addressNoteLabel: "כתובת / הערת מיקום",
    addressNotePlaceholder: "לדוגמה: הכתובת תישלח לאחר קביעת התור",
    saveButton: "שמירת פרטים",
    saving: "שומר…",
    success: "פרטי העסק נשמרו בהצלחה",
  },

  categories: {
    sectionTitle: "תחומי פעילות",
    hint: "בחרו את תחומי הפעילות שהעסק מציע. ניתן לבחור יותר מאחד.",
    saveButton: "שמירת תחומי פעילות",
    saving: "שומר…",
    success: "תחומי הפעילות נשמרו",
  },

  cancellationPolicy: {
    sectionTitle: "מדיניות ביטולים",
    hint: "הגדירו מדיניות ביטולים לעסק. המדיניות תוצג לפני קביעת תור ותסייע לצמצם ביטולים מאוחרים.",

    enabledLabel: "הפעלת מדיניות ביטולים",
    enabledHint: "כשמדיניות מופעלת, היא תוצג ללקוחות לפני שישלחו בקשת תור.",

    lateWindowLabel: "מתי ביטול נחשב מאוחר?",
    lateWindowHint: "ביטול שנעשה בפחות מהזמן הזה לפני התור ייחשב כביטול מאוחר.",
    lateWindowOptions: {
      "6": "6 שעות לפני התור",
      "12": "12 שעות לפני התור",
      "24": "24 שעות לפני התור",
      "48": "48 שעות לפני התור",
      custom: "מותאם אישית",
    },
    customHoursLabel: "מספר שעות מותאם",
    customHoursPlaceholder: "לדוגמה: 36",

    feeTypeLabel: "דמי ביטול מאוחר",
    feeTypeNone: "ללא דמי ביטול",
    feeTypeFixed: "סכום קבוע",
    feeTypePercentage: "אחוז ממחיר השירות",
    feeAmountLabel: "סכום דמי ביטול (₪)",
    feeAmountPlaceholder: "לדוגמה: 50",
    feePercentageLabel: "אחוז דמי ביטול",
    feePercentagePlaceholder: "לדוגמה: 30",

    policyTextLabel: "טקסט מדיניות (מוצג ללקוח)",
    policyTextPlaceholder: "לדוגמה: ביטול עד 24 שעות לפני התור — ללא חיוב. ביטול מאוחר יותר עשוי לחייב דמי ביטול.",
    policyTextHint: "הטקסט יוצג ללקוחות בעמוד ההזמנה. ניתן להשתמש במשתנים: {שעות}, {דמי_ביטול}, {שם_העסק}.",
    generateTextButton: "הפקת טקסט אוטומטי",

    manualFeeNote: "גבייה אוטומטית של דמי ביטול תתווסף בהמשך. כרגע ניתן לעקוב ולסמן ידנית.",

    saveButton: "שמירת מדיניות",
    saving: "שומר…",
    success: "מדיניות הביטולים נשמרה",
  },

  publicLink: {
    sectionTitle: "קישור הזמנה פשוט",
    active: "קישור פעיל",
    body: "זה קישור פשוט לבקשת תור. העסק עדיין מאשר כל בקשה ידנית.",
    slugLabel: "כתובת הקישור",
    copyButton: "העתקת קישור",
    copied: "הקישור הועתק",
  },

  errors: {
    nameRequired: "יש למלא שם עסק",
    phoneInvalid: "מספר הטלפון לא נראה תקין",
    minNoticeInvalid: "מספר השעות אינו תקין",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לעמוד ההזמנה הציבורי */
export const PUBLIC_BOOKING = {
  notFound: "הקישור לא נמצא",

  page: {
    howItWorks:
      "אפשר לבחור שירות ולשלוח בקשה לתור. העסק יאשר את הבקשה בהמשך.",
  },

  form: {
    title: "שליחת בקשה לתור",
    sectionService: "בחירת שירות",
    sectionClient: "פרטים ליצירת קשר",
    sectionDateTime: "מועד מבוקש",

    serviceLabel: "שירות",
    servicePlaceholder: "בחרו שירות…",
    serviceDurationSuffix: "דק׳",
    servicePricePrefix: "₪",

    clientNameLabel: "שם מלא",
    clientNamePlaceholder: "לדוגמה: נועה כהן",
    phoneLabel: "טלפון",
    phonePlaceholder: "050-0000000",
    noteLabel: "הערה קצרה",
    notePlaceholder: "אם יש משהו שחשוב לדעת…",
    noteOptional: "אופציונלי",

    dateLabel: "תאריך מבוקש",
    timeLabel: "שעה מבוקשת",

    policyTitle: "מדיניות ביטולים",
    policyAcknowledge: "קראתי את מדיניות הביטולים ואני מסכימה לתנאיה",

    approvalNote:
      "הבקשה תישלח לעסק לאישור. התור יאושר רק אחרי שהעסק יאשר אותו.",
    submitButton: "שליחת בקשה לתור",
    submitting: "שולח…",
  },

  success: {
    title: "הבקשה נשלחה בהצלחה",
    body: "העסק יחזור אליך לאישור התור.",
    sendAnother: "שליחת בקשה נוספת",
  },

  errors: {
    serviceRequired: "יש לבחור שירות",
    clientNameRequired: "יש למלא שם מלא",
    phoneRequired: "יש למלא מספר טלפון",
    phoneInvalid: "מספר הטלפון לא נראה תקין",
    dateRequired: "יש לבחור תאריך",
    timeRequired: "יש לבחור שעה",
    pastBooking: "לא ניתן לשלוח בקשה לזמן שכבר עבר",
    serviceUnavailable: "השירות שנבחר אינו זמין",
    overlap: "המועד הזה כבר תפוס, יש לבחור מועד אחר",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לפיצ׳ר חלונות פנויים בלוח הבקרה */
export const EMPTY_SLOTS = {
  sectionTitle: "חלונות פנויים",
  sectionSubtitle:
    "זיהינו שעות פנויות שאפשר לנסות למלא עם לקוחות קיימות.",
  noSlots: "אין חלונות פנויים משמעותיים בימים הקרובים",
  noSlotsSubtitle: "כל הזמן הקרוב תפוס. כל הכבוד!",
  freeWindow: "חלון פנוי",
  prepareMessage: "הכנת הודעה",
  suggestedClients: "לקוחות מומלצות:",
  genericMessage: "הודעה כללית",
  noSuggestedClients:
    "אין כרגע לקוחות מתאימות להצעה, אבל אפשר לשלוח הודעה ידנית.",
  copyButton: "העתקת הודעה",
  copiedSuccess: "ההודעה הועתקה",
  lastVisit: "ביקור אחרון",
  noVisit: "טרם ביקרה",
  guidance: {
    title: "יש חלונות פנויים ביומן",
    body: "אפשר לנסות למלא שעות פנויות עם לקוחות קיימות.",
    action: "צפייה בחלונות פנויים",
  },
} as const;

/** טקסטים לעמוד שימור לקוחות */
export const RETENTION = {
  nav: "שימור לקוחות",

  pageTitle: "שימור לקוחות",
  pageSubtitle:
    "כאן אפשר לזהות לקוחות שלא חזרו לאחרונה ולהכין הודעה מתאימה.",

  summary: {
    notReturned: "לקוחות שלא חזרו",
    withUpcoming: "לקוחות עם תור עתידי",
    messagesToSend: "הודעות שאפשר לשלוח",
  },

  card: {
    daysSince: (days: number) => `לא חזרה כבר ${days} ימים`,
    lastService: "הטיפול האחרון",
    lastVisit: "ביקור אחרון",
    totalVisits: "ביקורים",
    noShowHint: "הלקוחה לא הגיעה בעבר",
    cancellationHint: "ביטולים קודמים",
    prepareMessage: "הכנת הודעה",
    newBooking: "תור חדש",
    viewDetails: "פרטים",
  },

  message: {
    sectionTitle: "הודעה מוכנה לשליחה בוואטסאפ",
    withService: (clientName: string, serviceName: string, businessName: string) =>
      `היי ${clientName}, עבר זמן מה מאז התור האחרון שלך ל־${serviceName} אצל ${businessName}.\nאם תרצי לקבוע תור נוסף, אשמח למצוא לך מועד שמתאים לך ❤️`,
    withoutService: (clientName: string, businessName: string) =>
      `היי ${clientName}, עבר זמן מה מאז התור האחרון שלך אצל ${businessName}.\nאם תרצי לקבוע תור נוסף, אשמח למצוא לך מועד שמתאים לך ❤️`,
    copyButton: "העתקת הודעה",
    copied: "ההודעה הועתקה",
    close: "סגירה",
  },

  emptyState: {
    title: "אין כרגע לקוחות שדורשים מעקב",
    body: "לקוחות שלא חזרו תקופה ארוכה יופיעו כאן, כדי שיהיה קל לחזור אליהן בזמן הנכון.",
    cta: "צפייה בכל הלקוחות",
    ctaHref: "/clients",
  },

  clientProfileCard: {
    title: "הלקוחה לא חזרה לאחרונה",
    body: "אפשר לשלוח הודעה קצרה ולהציע לקבוע תור נוסף.",
    action: "הכנת הודעת חזרה",
  },

  guidance: {
    title: "יש לקוחות שלא חזרו לאחרונה",
    body: "אפשר לשלוח הודעה קצרה ולהציע לקבוע תור נוסף.",
    action: "מעבר להחזרת לקוחות",
  },
} as const;

/** טקסטים לעמוד מוניטין וביקורות */
export const REPUTATION = {
  pageTitle: "מוניטין וביקורות",
  pageSubtitle:
    "כאן אפשר להכין הודעות תודה ובקשות ביקורת אחרי טיפולים שהושלמו.",

  summary: {
    recentCompleted: "טיפולים שהושלמו לאחרונה",
    thankyouReady: "הודעות תודה שאפשר לשלוח",
    reviewReady: "בקשות ביקורת שאפשר להכין",
  },

  card: {
    completedBadge: "הושלם",
    completedDate: "תאריך הטיפול",
    price: "מחיר",
    thankyouButton: "הודעת תודה",
    reviewButton: "בקשת ביקורת",
    bookingDetails: "פרטי תור",
    clientDetails: "פרטי לקוחה",
  },

  message: {
    thankyouTitle: "הודעת תודה",
    reviewTitle: "בקשת ביקורת",
    copyButton: "העתקת הודעה",
    copied: "ההודעה הועתקה",
    close: "סגירה",
  },

  thankyou: {
    today: (clientName: string, serviceName: string, businessName: string) =>
      `היי ${clientName}, תודה שהגעת היום ל־${serviceName} אצל ${businessName}.\nנשמח לראות אותך שוב ❤️`,
    other: (clientName: string, serviceName: string, businessName: string) =>
      `היי ${clientName}, תודה שהגעת ל־${serviceName} אצל ${businessName}.\nנשמח לראות אותך שוב ❤️`,
  },

  review: (clientName: string, businessName: string) =>
    `היי ${clientName}, תודה שבחרת ב־${businessName}.\nאם נהנית מהטיפול, נשמח מאוד לביקורת קצרה או המלצה. זה מאוד עוזר לעסק ❤️`,

  emptyState: {
    title: "אין טיפולים שהושלמו לאחרונה",
    body: "טיפולים שהושלמו ב־14 הימים האחרונים יופיעו כאן — כדי שיהיה קל לשלוח הודעת תודה או לבקש ביקורת.",
    cta: "צפייה בתורים",
    ctaHref: "/bookings",
  },

  clientCard: {
    title: "טיפול שהושלם לאחרונה",
    body: "אפשר לשלוח הודעת תודה או לבקש ביקורת מהלקוחה.",
    thankyouAction: "הודעת תודה",
    reviewAction: "בקשת ביקורת",
    close: "סגירה",
    copyButton: "העתקת הודעה",
    copied: "ההודעה הועתקה",
    goToReputation: "כל הטיפולים שהושלמו",
  },

  guidance: {
    title: "יש טיפולים שהושלמו לאחרונה",
    body: "אפשר לשלוח הודעת תודה או בקשת ביקורת כדי לחזק את הקשר עם הלקוחות.",
    action: "מעבר לאוטומציות",
  },
} as const;

/** טקסטים לעמוד תובנות מחיר */
export const PRICING = {
  nav: "תובנות מחיר",

  pageTitle: "תובנות מחיר",
  pageSubtitle:
    "כאן אפשר להבין טוב יותר כמה כל שירות מכניס ביחס לזמן, למקדמות ולטווחי מחיר שהוגדרו.",

  summary: {
    servicesCount: "שירותים פעילים",
    avgPricePerHour: "ממוצע לשעה",
    servicesWithRange: "עם טווח מחיר",
  },

  card: {
    pricePerHour: "לשעה",
    duration: "משך טיפול",
    price: "מחיר",
    completedBookings: "תורים שהושלמו",
    editRange: "עריכת טווח",
    cancelEdit: "ביטול",
    editService: "עריכת השירות",
    noRange: "לא הוגדר טווח להשוואה",
    inactiveNote: "השירות לא פעיל ולכן לא נכלל בהשוואות.",
    rangeMin: "מינימום בטווח",
    rangeAvg: "ממוצע בטווח",
    rangeMax: "מקסימום בטווח",
  },

  insights: {
    lowHourlyValue: {
      title: "מחיר נמוך יחסית לשעה",
      body: "השירות הזה מכניס פחות לשעה ביחס לשאר השירותים בעסק.",
    },
    highHourlyValue: {
      title: "מחיר גבוה יחסית לשעה",
      body: "השירות הזה מכניס יותר לשעה ביחס לשאר השירותים בעסק.",
    },
    longLowPrice: {
      title: "שירות ארוך עם מחיר נמוך לשעה",
      body: "זה שירות ארוך יחסית עם מחיר נמוך לשעה. כדאי לבדוק אם המחיר עדיין משתלם.",
    },
    popularService: {
      title: "שירות מבוקש",
      body: "זה אחד השירותים המבוקשים בעסק. אם הביקוש גבוה, ייתכן שכדאי לבדוק את המחיר.",
    },
    belowRange: {
      title: "נמוך מהטווח שהוגדר",
      body: "המחיר של השירות נמוך מהטווח שהוגדר. ייתכן שיש מקום לבדוק העלאת מחיר, במיוחד אם השירות מבוקש ולוקח זמן.",
    },
    withinRange: {
      title: "בטווח שהוגדר",
      body: "המחיר נמצא בטווח שהוגדר לשירותים דומים.",
    },
    aboveRange: {
      title: "גבוה מהטווח שהוגדר",
      body: "המחיר גבוה מהטווח שהוגדר. כדאי לוודא שהתיאור, התוצאה והערך ללקוחה ברורים.",
    },
  },

  marketRange: {
    sectionTitle: "טווח מחיר מקובל",
    sectionOptional: "אופציונלי",
    hint: "אפשר להזין טווח ידני לפי מה שמוכר לך מהאזור או מהתחום. Allura לא מושכת מחירי שוק אוטומטית בשלב הזה.",
    minLabel: "מחיר נמוך בטווח",
    avgLabel: "מחיר ממוצע בטווח",
    maxLabel: "מחיר גבוה בטווח",
    minPlaceholder: "לדוגמה: 150",
    avgPlaceholder: "לדוגמה: 200",
    maxPlaceholder: "לדוגמה: 280",
    saveButton: "שמירת טווח",
    saving: "שומר…",
    saved: "טווח המחיר נשמר",
    clear: "מחיקת טווח",
  },

  emptyState: {
    title: "אין שירותים פעילים",
    body: "כדי לראות תובנות מחיר, כדאי להוסיף לפחות שירות אחד.",
    cta: "הוספת שירות",
    ctaHref: "/services/new",
  },

  errors: {
    minInvalid: "המחיר המינימלי אינו תקין",
    avgInvalid: "המחיר הממוצע אינו תקין",
    maxInvalid: "המחיר המקסימלי אינו תקין",
    rangeInvalid: "הטווח אינו תקין — מינימום חייב להיות קטן ממקסימום",
    avgOutOfRange: "המחיר הממוצע חייב להיות בין המינימום למקסימום",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },

  guidance: {
    title: "יש שירותים שכדאי לבדוק את המחיר שלהם",
    body: "מצאנו שירותים שאולי מתומחרים נמוך ביחס לזמן או לטווח שהוגדר.",
    action: "מעבר לשירותים",
  },
} as const;

/** טקסטים לפיצ׳ר לקוחות בסיכון (Allura Pro) */
export const AT_RISK = {
  pageTitle: "לקוחות בסיכון",
  pageSubtitle: "לקוחות שעלולות לא לחזור — כדאי לפנות אליהן לפני שמאוחר מדי.",

  proBadge: "Pro",

  summary: {
    total: "לקוחות בסיכון",
    critical: "סיכון קריטי",
    high: "סיכון גבוה",
    medium: "סיכון בינוני",
  },

  riskLevel: {
    low: "סיכון נמוך",
    medium: "סיכון בינוני",
    high: "סיכון גבוה",
    critical: "סיכון קריטי",
  },

  riskDays: {
    low: "30–44 ימים",
    medium: "45–59 ימים",
    high: "60–89 ימים",
    critical: "90+ ימים",
  },

  card: {
    lastVisit: "ביקור אחרון",
    totalRevenue: "סה״כ הכנסות",
    totalVisits: "תורים שהושלמו",
    daysAgo: (days: number) => `לפני ${days} ימים`,
    openWhatsApp: "פתיחה בוואטסאפ",
    sendMessage: "שליחת הודעה",
    viewClient: "פרופיל לקוחה",
    newBooking: "תור חדש",
    messageSectionTitle: "הודעת חזרה ללקוחה",
    copyMessage: "העתקת הודעה",
    messageCopied: "הועתק",
    closeMessage: "סגירה",
  },

  emptyState: {
    title: "אין לקוחות בסיכון כרגע",
    body: "כל הלקוחות שלך חזרו לאחרונה. כשלקוחה לא תחזור יותר מ-30 יום, היא תופיע כאן.",
    cta: "צפייה בכל הלקוחות",
    ctaHref: "/clients",
  },

  guidanceTitle: "מה לעשות?",
  guidanceBody: "שלחי הודעת חזרה ללקוחות בסיכון גבוה קודם. לקוחות שלא חזרו 60+ יום הן הדחופות ביותר.",
  winBackCta: "יצירת קמפיין החזרה",
} as const;

/** טקסטים לפיצ׳ר קמפיינים להחזרת לקוחות (Allura Pro) */
export const WIN_BACK = {
  pageTitle: "יצירת קמפיין החזרה",
  pageSubtitle:
    "בחרי קהל יעד, ערכי הודעה ושלחי קמפיין חזרה ללקוחות שלא הגיעו זמן רב.",

  proBadge: "Pro",

  metrics: {
    totalRecoverable: "לקוחות להחזרה",
    revenuePotential: "פוטנציאל הכנסה",
    campaignsAvailable: "קמפיינים זמינים",
    messagesReady: "הודעות מוכנות",
  },

  selectCampaignTitle: "בחרי קמפיין",
  selectCampaignHint:
    "בחרי קמפיין כדי לראות את הלקוחות המתאימות ואת ההודעה המוצעת",

  campaigns: {
    "30": {
      title: "קמפיין חזרה אחרי 30 יום",
      goal: "לחדש קשר עם לקוחות שלא הגיעו בחודש האחרון",
      subtitle: "מתאים לתזכורת עדינה וחידוש קשר",
      recommendedTone: "עדינה",
      cta: "יצירת קמפיין",
    },
    "60": {
      title: "קמפיין חזרה אחרי 60 יום",
      goal: "להחזיר לקוחות שלא הגיעו ב-60 יום",
      subtitle: "מתאים להצעה אישית או הטבת חזרה",
      recommendedTone: "אישית",
      cta: "יצירת קמפיין",
    },
    "90": {
      title: "קמפיין חזרה אחרי 90 יום",
      goal: "להציל לקוחות בסיכון גבוה לפני שיתנתקו לחלוטין",
      subtitle: "לקוחות בסיכון גבוה שכדאי להחזיר עכשיו",
      recommendedTone: "מכירתית",
      cta: "יצירת קמפיין",
    },
    vip: {
      title: "קמפיין VIP שלא חזרו",
      goal: "לשמר לקוחות VIP שהכניסו הכי הרבה לעסק",
      subtitle: "לקוחות שהכניסו הרבה כסף לעסק ונעלמו",
      recommendedTone: "יוקרתית",
      cta: "יצירת קמפיין",
    },
  },

  builder: {
    backLabel: "חזרה לבחירת קמפיין",
    audienceTitle: "קהל היעד",
    audienceCount: "לקוחות",
    audienceRevenue: "פוטנציאל הכנסה",
    audienceAvgDays: "ממוצע ימים מאז ביקור",
    audienceCommonService: "שירות נפוץ",
    messageTitle: "הודעת הקמפיין",
    toneLabel: "טון ההודעה",
    tones: {
      gentle: "עדינה",
      personal: "אישית",
      sales: "מכירתית",
      luxury: "יוקרתית",
      short: "קצרה לוואטסאפ",
    },
    variablesTitle: "משתנים זמינים",
    variables: ["{שם}", "{שם העסק}", "{שירות אחרון}", "{הטבה}", "{קישור להזמנה}"],
    previewTitle: "תצוגה מקדימה",
    previewFor: "עבור",
    recipientsTitle: "רשימת הנמענים",
    copyMessage: "העתקת הודעה",
    messageCopied: "הועתק",
    sendWhatsApp: "שליחה בוואטסאפ",
    openProfile: "פרופיל לקוחה",
    newBooking: "תור חדש",
    daysAgo: (days: number) => `לפני ${days} ימים`,
    noRecipientsTitle: "אין כרגע לקוחות שמתאימות לקמפיין הזה",
    noRecipientsBody: "וזה סימן מעולה 🌟",
  },

  card: {
    lastVisit: "ביקור אחרון",
    lastService: "שירות אחרון",
    totalRevenue: "סה״כ הכנסות",
    totalVisits: "תורים שהושלמו",
    daysAgo: (days: number) => `לפני ${days} ימים`,
    openWhatsApp: "פתיחה בוואטסאפ",
    sendWhatsApp: "שליחה בוואטסאפ",
    copyMessage: "העתקת הודעה",
    messageCopied: "הועתק",
    newBooking: "קביעת תור",
    viewClient: "פרופיל לקוחה",
    messagePreviewTitle: "הודעה מוצעת",
    closeMessage: "סגירה",
    showMessage: "הצגת הודעה",
  },

  emptyState: {
    title: "כרגע אין לקוחות שמתאימות לקמפיין הזה",
    body: "וזה סימן טוב 🌟",
  },

  recipientsCount: (count: number) => `${count} לקוחות מתאימות`,

  steps: {
    audienceLabel: "קהל היעד",
    offerLabel: "הטבת הקמפיין",
    messageLabel: "הודעת הקמפיין",
    sendLabel: "שליחה ומעקב",
  },

  audienceWhy: {
    "30": "לקוחות שלא הגיעו בין 30 ל-60 יום — מתאימות לתזכורת עדינה",
    "60": "לקוחות שלא הגיעו בין 60 ל-90 יום — כדאי להגיע עם הצעה",
    "90": "לקוחות שלא הגיעו 90 יום ומעלה — בסיכון גבוה לאיבוד",
    vip: "לקוחות VIP עם 4 ביקורים+ או ₪500+ שלא חזרו",
  },

  offers: {
    sectionSubtitle: "הטבה מגדילה את הסיכוי שלקוחות יחזרו",
    autoNote: "ההטבה תשולב אוטומטית בהודעה",
    none: "ללא הטבה",
    discount_10: "10% הנחה",
    upgrade_gift: "שדרוג טיפול מתנה",
    special_slot: "תור פנוי מיוחד",
    personal: "הטבה אישית",
  },

  revenueImpact: {
    sectionTitle: "פוטנציאל ההכנסה",
    sectionSubtitle: "הערכה לפי ממוצע ביקורים קודמים",
    audienceSize: (n: number) => `${n} לקוחות בקמפיין`,
    if1Returns: "אם לקוחה אחת תחזור",
    ifCountReturns: (n: number) => `אם ${n} יחזרו`,
  },

  tracking: {
    sectionTitle: "מעקב שליחה",
    localNote: "המעקב מאופס בכל טעינת עמוד",
    statusHint: "לחצי לשינוי סטטוס",
    summaryPending: (n: number) => `${n} ממתינות`,
    summarySent: (n: number) => `${n} נשלחו ידנית`,
    summaryAnswered: (n: number) => `${n} ענו`,
    summaryNoAnswer: (n: number) => `${n} לא ענו`,
    summaryBooked: (n: number) => `${n} קבעו תור`,
  },
} as const;

/** תחזית הכנסות */
export const REVENUE_FORECAST = {
  pageTitle: "תחזית הכנסות",
  pageSubtitle: "ראי כמה העסק צפוי להכניס החודש ומה כדאי לעשות כדי להגיע ליעד.",

  hero: {
    expectedLabel: "צפי החודש",
    gapLabel: "חסר ליעד",
    progressLabel: "התקדמות לקראת היעד",
    noGap: "הגעת ליעד! 🎉",
    provisionalTarget: "יעד זמני",
    provisionalTargetNote: "היעד יתעדכן ככל שיצטברו יותר תורים והכנסות במערכת.",
    confidence: {
      high: "אמינות גבוהה",
      medium: "אמינות בינונית",
      low: "אמינות נמוכה",
    },
    lowConfidenceNote: "עדיין אין מספיק נתונים היסטוריים לחישוב מדויק.",
  },

  metrics: {
    completedRevenue: "הכנסה בפועל",
    completedRevenueNote: "מתורים שהושלמו החודש",
    expectedRevenue: "הכנסה צפויה",
    expectedRevenueNote: "הושלמו + תורים מאושרים",
    monthlyTarget: "יעד חודשי",
    monthlyTargetNote: "חודש שעבר + 15%",
    monthlyTargetProvisionalNote: "יעד זמני — יתעדכן עם יותר נתונים",
    noTargetYet: "אין עדיין מספיק נתונים",
    gapToTarget: "פער ליעד",
    gapToTargetNote: "נדרש להגיע ליעד",
    avgBookingValue: "שווי תור ממוצע",
    avgBookingValueNote: "לפי תורים שהושלמו",
    lostRevenue: "הכנסה שאבדה",
    lostRevenueNote: "ביטולים ואי-הגעה החודש",
  },

  timeline: {
    title: "פירוט הצפי החודשי",
    completed: "הכנסה בפועל",
    upcoming: "תורים קרובים",
    gap: "פער ליעד",
    lost: "הכנסה שאבדה",
  },

  recommendations: {
    title: "מה אפשר לעשות כדי להגיע ליעד?",
    emptySlots: (count: number, revenue: number) =>
      `יש לך ${count} חלונות פנויים שיכולים להוסיף כ-₪${Math.round(revenue).toLocaleString("he-IL")}`,
    emptySlotsAction: "מילוי חלונות פנויים",
    emptySlotsHref: "/dashboard",
    atRisk: (count: number) =>
      `יש ${count} לקוחות בסיכון עם פוטנציאל הכנסה שטרם מומש`,
    atRiskAction: "צפייה בלקוחות בסיכון",
    atRiskHref: "/bring-back",
    winBack: "שלחי קמפיין החזרה ללקוחות שלא הגיעו",
    winBackAction: "יצירת קמפיין החזרה",
    winBackHref: "/win-back-campaigns",
    fillGap: "מלאי חלונות פנויים השבוע",
    fillGapAction: "שעות פעילות",
    fillGapHref: "/availability",
    noActions: "כל הכבוד! העסק על המסלול הנכון 🌟",
  },

  services: {
    title: "שירותים שמכניסים הכי הרבה",
    bookingsCount: "תורים",
    revenue: "הכנסה",
    avgPrice: "מחיר ממוצע",
    noServices: "עדיין אין נתוני שירות לחודש זה",
  },

  noTarget: "אין מספיק נתונים ליעד מדויק",

  emptyState: {
    title: "עדיין אין מספיק נתונים לתחזית מדויקת",
    body: "ככל שתנהלי יותר תורים דרך Allura, התחזית תהפוך לחכמה ומדויקת יותר.",
  },

  dayProgress: (passed: number, total: number) =>
    `יום ${passed} מתוך ${total} בחודש`,
} as const;

/** טקסטים לפיצ׳ר החזרת לקוחות */
export const BRING_BACK = {
  pageTitle: "החזרת לקוחות",
  pageSubtitle: "המערכת מזהה לקוחות שלא חזרו בזמן ומכינה עבורך הודעת חזרה אישית.",

  explanationBanner: (days: number) =>
    `לקוחות שלא חזרו אחרי ${days} ימים מופיעות כאן. אפשר לשלוח להן הודעה ידנית בוואטסאפ, ובהמשך השליחה תהיה אוטומטית.`,

  thresholdLabel: "מתי לקוחה נחשבת שלא חזרה?",
  thresholdHelperText: "לקוחות בלי תור עתידי שלא הגיעו מעל מספר הימים שבחרת יוצגו כאן.",
  thresholdUnit: "ימים",
  thresholdCustom: "מותאם אישית",
  thresholdApply: "החל",

  summary: {
    total: "לקוחות להחזרה",
    critical: "קריטי",
    high: "דחוף",
    medium: "כדאי לפנות",
  },

  segments: {
    critical: {
      label: "קריטי",
      days: "90+ ימים",
      description: "לקוחות שלא חזרו מעל 90 ימים — פנייה דחופה עכשיו",
    },
    high: {
      label: "דחוף",
      days: "60–89 ימים",
      description: "לקוחות שלא חזרו כבר חודשיים — כדאי לפנות אליהן השבוע",
    },
    medium: {
      label: "כדאי לפנות",
      days: "30–59 ימים",
      description: "תזכורת מוקדמת — פנייה עכשיו עוזרת להחזיר לקוחות",
    },
  },

  card: {
    lastVisit: "ביקור אחרון",
    lastService: "שירות אחרון",
    totalVisits: "ביקורים",
    totalRevenue: "סה״כ הכנסות",
    daysAgo: (days: number) => `לפני ${days} ימים`,
    prepareMessage: "שלחי הודעת חזרה",
    closeMessage: "סגירה",
    newBooking: "קבעי תור",
    viewProfile: "פרופיל לקוחה",
  },

  message: {
    offerLabel: "הטבה להוסיף להודעה",
    offers: {
      none: "ללא הטבה",
      discount10: "10% הנחה לתור הבא",
      upgrade: "שדרוג טיפול מתנה",
      specialSlot: "תור פנוי מיוחד",
    },
    previewTitle: "הודעה מוכנה לשליחה",
    copyButton: "העתקי הודעה לשליחה בוואטסאפ",
    copied: "הועתק ✓",
    build: (
      clientName: string,
      businessName: string,
      lastServiceName: string,
      offer: string,
    ) => {
      const base = `היי ${clientName}, עבר זמן מה מאז הטיפול האחרון שלך ב${lastServiceName} אצל ${businessName}.`;
      const offerLine = offer ? `\n${offer}` : "";
      return `${base}${offerLine}\nנשמח לראות אותך שוב — ניתן לקבוע תור בכל זמן שנוח לך ❤️`;
    },
  },

  emptyState: {
    title: "כרגע אין לקוחות שצריך להחזיר — מעולה!",
    body: "כשתהיה לקוחה שלא חזרה לפי ההגדרה שבחרת, היא תופיע כאן.",
    cta: "בדקי לקוחות",
    ctaHref: "/clients",
  },
} as const;

/** טקסטים לייבוא לקוחות */
export const CLIENT_IMPORT = {
  pageTitle: "ייבוא לקוחות",
  pageSubtitle: "יש לך רשימת לקוחות? העלי אותה לכאן ו-Allura תסדר אותה עבורך.",

  importButton: "ייבוא לקוחות",

  steps: {
    upload: "העלאה",
    mapping: "התאמת עמודות",
    preview: "תצוגה מקדימה",
    import: "ייבוא",
  },

  upload: {
    title: "הוספת לקוחות קיימות למערכת",
    subtitle: "בחרי איך להביא את הרשימה",

    methodFile: "העלאת קובץ CSV",
    methodFileDesc: "קובץ מאקסל שנשמר בפורמט CSV",
    methodPaste: "הדבקת רשימה ידנית",
    methodPasteDesc: "שם ומספר טלפון — שורה לכל לקוחה",

    fileLabel: "קובץ CSV",
    fileHint: "ניתן לייצא מ-Excel כ-\"CSV UTF-8\".",
    fileBrowse: "בחירת קובץ",
    fileSelected: (name: string) => `קובץ נבחר: ${name}`,

    pasteLabel: "הדבקת רשימה",
    pastePlaceholder:
      "נועה כהן, 050-1111111\nמיה לוי, 052-2222222\nרוני מזרחי, 053-3333333",
    pasteHint: "כל שורה = לקוחה אחת. שם ומספר טלפון מופרדים בפסיק.",

    nextButton: "המשך",
    processingButton: "מעבד…",
    emptyError: "יש להזין רשימה או לבחור קובץ",
  },

  mapping: {
    title: "התאמת עמודות",
    subtitle: "וודאי שכל עמודה ממופה לשדה הנכון",

    fieldName: "שם לקוחה",
    fieldPhone: "טלפון",
    fieldEmail: "אימייל",
    fieldNotes: "הערות",

    required: "(חובה)",
    optional: "(אופציונלי)",
    notMapped: "— לא למפות —",

    previewTitle: "תצוגה מקדימה של הקובץ",
    previewRow: "שורה",

    nameRequired: "יש לבחור עמודת שם",
    phoneRequired: "יש לבחור עמודת טלפון",

    nextButton: "המשך לתצוגה מקדימה",
    backButton: "חזרה",
  },

  preview: {
    title: "תצוגה מקדימה",
    subtitle: "נציג לך תצוגה מקדימה לפני שנוסיף לקוחות למערכת.",
    duplicateNote: "לא ניצור כפילויות — לקוחות עם אותו מספר טלפון ידולגו.",

    columnName: "שם",
    columnPhone: "טלפון",
    columnEmail: "אימייל",
    columnStatus: "סטטוס",

    status: {
      valid: "תקין",
      no_name: "חסר שם",
      no_phone: "חסר טלפון",
      invalid_phone: "טלפון לא תקין",
      in_file_duplicate: "כפילות בקובץ",
    } as Record<string, string>,

    summaryValid: (n: number) => `${n} לקוחות מוכנות לייבוא`,
    summaryDuplicate: (n: number) => `${n} כפילויות בקובץ (ידולגו)`,
    summaryInvalid: (n: number) => `${n} שורות עם שגיאה (לא יובאו)`,

    noValidRows: "אין שורות תקינות לייבוא. אנא בדקי את הקובץ.",

    optInLabel: "אישרו קבלת הודעות WhatsApp",
    optInHelper:
      "סמני אם הלקוחות שמייבאת אישרו לקבל הודעות ממך בוואטסאפ. ניתן לשנות את ההסכמה בפרופיל כל לקוחה בנפרד.",

    importButton: (n: number) => `ייבוא ${n} לקוחות`,
    importingButton: "מייבא…",
    backButton: "חזרה",
  },

  result: {
    title: "הייבוא הסתיים",

    created: (n: number) =>
      n === 1 ? "לקוחה אחת נוספה בהצלחה" : `${n} לקוחות נוספו בהצלחה`,
    duplicates: (n: number) =>
      n === 1 ? "כפילות אחת דולגה" : `${n} כפילויות דולגו`,
    failed: (n: number) =>
      n === 1 ? "שורה אחת לא יובאה" : `${n} שורות לא יובאו`,

    ctaViewClients: "צפייה בלקוחות",
    ctaImportMore: "ייבוא קובץ נוסף",
    ctaBringBack: "מעבר להחזרת לקוחות",
    bringBackNote:
      "כדי שלקוחות מיובאות יופיעו בהחזרת לקוחות, נדרש תאריך ביקור אחרון או היסטוריית תורים.",
  },
} as const;

/** טקסטים לאוטומציות ותזכורות תורים */
export const AUTOMATIONS = {
  pageTitle: "אוטומציות",
  pageSubtitle: "תזכורות והודעות שנשלחות אוטומטית כדי לחסוך זמן ולהחזיר לקוחות.",

  reminders: {
    sectionTitle: "תזכורות תורים",
    sectionSubtitle:
      "הגדירי מתי לקוחות יקבלו תזכורת לפני התור והכיני הודעות לשליחה בוואטסאפ.",

    manualModeBanner:
      "כרגע התזכורות מוכנות לשליחה ידנית דרך וואטסאפ. שליחה אוטומטית תתווסף בהמשך.",
    manualModeLabel: "שליחה ידנית בוואטסאפ",
    autoModeLabel: "שליחה אוטומטית — בקרוב",

    settings: {
      sectionTitle: "הגדרות תזכורת",
      timingLabel: "מתי לשלוח תזכורת לפני תור?",
      timingHelper:
        "תורים שיגיע הזמן להזכיר לגביהם יופיעו כאן לשליחה ידנית בוואטסאפ.",
      timing24: "24 שעות לפני התור",
      timing12: "12 שעות לפני התור",
      timing3: "3 שעות לפני התור",
      timing1: "שעה לפני התור",
      timingCustom: "זמן מותאם אישית",
      customHoursLabel: "מספר שעות לפני התור",
      customHoursPlaceholder: "לדוגמה: 6",

      templateLabel: "תבנית הודעת תזכורת",
      templatePlaceholder: "כתבי כאן את תבנית ההודעה…",
      templateDefault:
        "היי {שם}, מזכירה לך שיש לך תור ל{שירות} אצל {שם העסק} בתאריך {תאריך} בשעה {שעה}. מחכה לראותך 💕",
      availableVariables: "משתנים זמינים:",
      variableChips: [
        "{שם}",
        "{שם העסק}",
        "{שירות}",
        "{תאריך}",
        "{שעה}",
        "{קישור להזמנה}",
      ],

      saveButton: "שמירת הגדרות",
      saving: "שומר…",
      saved: "ההגדרות נשמרו בהצלחה",
    },

    dueList: {
      sectionTitle: "תזכורות שצריך לשלוח",
      sectionSubtitle: "תורים שמגיע הזמן לשלוח להם תזכורת לפי ההגדרה שבחרת",
      emptyTitle: "כרגע אין תזכורות שצריך לשלוח",
      emptyBody:
        "כשתור יתקרב לפי הזמן שהגדרת, הוא יופיע כאן.",

      columnClient: "לקוחה",
      columnService: "שירות",
      columnDate: "תאריך ושעה",
      columnStatus: "סטטוס",

      status: {
        pending: "ממתינה לשליחה",
        sent: "נשלחה ידנית",
        cancelled: "תור בוטל",
        failed: "לא נשלחה",
        none: "ממתינה לשליחה",
      } as Record<string, string>,

      actionWhatsApp: "שלחי תזכורת בוואטסאפ",
      actionCopy: "העתקת הודעה",
      actionMarkSent: "סימון כנשלחה",
      actionMarkPending: "סימון כממתינה",
      actionViewBooking: "צפייה בתור",
      messageCopied: "ההודעה הועתקה",

      reminderIn: (hours: number) => `תזכורת ${hours} שעות לפני`,
    },
  },

  dashboard: {
    attentionTitle: "תזכורות לשליחה",
    attentionSingle: "תזכורת מוכנה",
    attentionMultiple: (n: number) => `${n} תזכורות מוכנות`,
    cta: "שליחת תזכורות",
  },
} as const;

/** טקסטים לניהול עמוד הלקוחות (הגדרות ועיצוב עמוד הזמנה ציבורי) */
export const PUBLIC_PAGE = {
  pageTitle: "עמוד לקוחות",
  pageSubtitle: "הגדירי איך העמוד הציבורי של העסק ייראה ומה הלקוחות יוכלו לראות.",

  preview: {
    sectionTitle: "קישור הזמנה",
    description: "זה הקישור שתוכלי לשלוח ללקוחות כדי לקבוע תור.",
    openButton: "פתיחת העמוד",
    copyButton: "העתקת קישור",
    copied: "הקישור הועתק",
  },

  profile: {
    sectionTitle: "פרטי העסק בעמוד",
    nameLabel: "שם העסק",
    namePlaceholder: "שם שיוצג בעמוד הציבורי",
    descriptionLabel: "תיאור קצר",
    descriptionPlaceholder: "כמה מילים על העסק, מה מיוחד בו",
    phoneLabel: "טלפון להצגה",
    phonePlaceholder: "מספר טלפון שיוצג ללקוחות",
    addressLabel: "כתובת / אזור פעילות",
    addressPlaceholder: "לדוגמה: תל אביב, גוש דן",
    instagramLabel: "אינסטגרם (אופציונלי)",
    instagramPlaceholder: "https://instagram.com/...",
    introMessageLabel: "הודעת פתיחה ללקוחות",
    introMessagePlaceholder: "לדוגמה: ברוכה הבאה לסטודיו שלנו. כאן תוכלי לבחור שירות ולקבוע תור בקלות.",
    saveButton: "שמירת הפרטים",
    saving: "שומר…",
    success: "פרטי העמוד נשמרו בהצלחה",
  },

  branding: {
    sectionTitle: "לוגו ותמונת קאבר",
    logoLabel: "לוגו העסק",
    logoHint: "תמונה ריבועית. גודל מומלץ: 200×200.",
    coverLabel: "תמונת קאבר",
    coverHint: "תמונה רחבה שתוצג בראש העמוד. גודל מומלץ: 1200×400.",
    saveButton: "שמירת תמונות",
    saving: "שומר…",
    success: "התמונות נשמרו בהצלחה",
  },

  visibility: {
    sectionTitle: "מה מוצג בעמוד",
    showServices: "הצגת שירותים",
    showPrices: "הצגת מחירים ללקוחות",
    showHours: "הצגת שעות פעילות",
    showReviews: "הצגת ביקורות",
    showGallery: "הצגת גלריית עבודות",
    showCancellationPolicy: "הצגת מדיניות ביטולים",
    showPhone: "הצגת טלפון העסק",
    showAddress: "הצגת כתובת",
    saveButton: "שמירת הגדרות",
    saving: "שומר…",
    success: "ההגדרות נשמרו בהצלחה",
  },

  gallery: {
    sectionTitle: "גלריית עבודות",
    sectionSubtitle: "העלי תמונות שיוצגו בעמוד הלקוחות. ניתן להעלות מספר תמונות בבת אחת.",
    addButton: "הוספת תמונה",
    adding: "מוסיף…",
    deleteButton: "מחיקה",
    deleting: "מוחק…",
    emptyState: "עדיין לא הועלו תמונות לגלריה",
    addSuccess: "התמונה נוספה בהצלחה",
    deleteSuccess: "התמונה נמחקה",
    errors: {
      urlRequired: "יש להזין קישור לתמונה",
      generic: "משהו השתבש. יש לנסות שוב",
    },
  },

  reviews: {
    sectionTitle: "ביקורות",
    addButton: "הוספת ביקורת",
    adding: "מוסיף…",
    deleteButton: "מחיקה",
    clientNameLabel: "שם הלקוחה",
    clientNamePlaceholder: "לדוגמה: נועה כ.",
    reviewTextLabel: "תוכן הביקורת",
    reviewTextPlaceholder: "מה אמרה הלקוחה?",
    ratingLabel: "דירוג (1–5)",
    emptyState: "עדיין לא נוספו ביקורות",
    addSuccess: "הביקורת נוספה בהצלחה",
    deleteSuccess: "הביקורת נמחקה",
    errors: {
      clientNameRequired: "יש למלא שם לקוחה",
      reviewTextRequired: "יש למלא תוכן ביקורת",
      generic: "משהו השתבש. יש לנסות שוב",
    },
  },

  treatmentHistory: {
    sectionTitle: "היסטוריית טיפולים אישית — בקרוב",
    description:
      "לקוחות יוכלו לצפות בהיסטוריית הטיפולים שלהן באזור אישי מאובטח.",
  },

  errors: {
    generic: "משהו השתבש. יש לנסות שוב",
  },
} as const;

/** טקסטים לעמודים שטרם מומשו (מצבי ריק ידידותיים) */
export const PLACEHOLDERS = {
  default: "העמוד הזה ייפתח בשלב הבא",
  bookings: {
    title: "התורים שלך יופיעו כאן",
    message:
      "אחרי שתגדירו שירותים ושעות פעילות, תוכלו להתחיל לקבל ולנהל תורים.",
  },
  clients: {
    title: "הלקוחות שלך יופיעו כאן",
    message: "לקוחות יתווספו אוטומטית כשיתחילו להיקבע תורים.",
  },
  services: {
    title: "השירותים שלך יופיעו כאן",
    message: "בשלב הבא נוסיף אפשרות להגדיר שירותים, מחירים וזמני טיפול.",
  },
  availability: {
    title: "שעות הפעילות יוגדרו כאן",
    message: "בקרוב תוכלו לבחור ימים ושעות שבהם העסק פתוח לקבלת תורים.",
  },
  messages: {
    title: "ההודעות המוכנות יופיעו כאן",
    message: "כאן יהיו הודעות מוכנות לשליחה בוואטסאפ ללקוחות.",
  },
  settings: {
    title: "הגדרות העסק",
    message: "כאן תוכלו לעדכן פרטי עסק, קישור ציבורי והעדפות נוספות.",
  },
} as const;

/** טקסטים לעמוד ניהול כספים */
export const FINANCE = {
  pageTitle: "כספים",
  pageSubtitle: "עקבי אחרי הכנסות, הוצאות ורווח משוער של העסק.",

  periods: {
    today: "היום",
    week: "השבוע",
    month: "החודש",
    year: "השנה",
  },

  summary: {
    revenue: "הכנסות בפועל",
    expenses: "הוצאות",
    profit: "רווח משוער",
    expensePct: "מהוצאות מתוך הכנסות",
    completedBookings: "תורים שהושלמו",
    avgBookingValue: "שווי תור ממוצע",
    upcomingRevenue: "הכנסה צפויה מתורים עתידיים",
    upcomingRevenueNote: "הכנסה צפויה מתורים עתידיים אינה נכללת ברווח בפועל.",
  },

  profitVisual: {
    title: "פירוט כספי",
    helper: "רווח משוער = הכנסות בפועל פחות הוצאות",
    helperNoExpenses: "עדיין לא נוספו הוצאות, לכן הרווח המשוער שווה להכנסות בפועל.",
  },

  topServices: {
    title: "שירותים שהכניסו הכי הרבה",
    bookings: "תורים",
    revenue: "הכנסות",
    avgPrice: "ממוצע לתור",
    empty: "אין עדיין נתונים לתקופה הזו.",
  },

  expenseList: {
    title: "הוצאות",
    addButton: "הוספת הוצאה",
    editButton: "עריכה",
    deleteButton: "מחיקה",
    deleteConfirm: "למחוק את ההוצאה?",
    deleting: "מוחק…",
    amount: "סכום",
    date: "תאריך",
    category: "קטגוריה",
    description: "תיאור",
    notes: "הערות",
    empty: "עדיין לא נוספו הוצאות.",
    emptyCta: "הוספת הוצאה ראשונה",
  },

  expenseForm: {
    addTitle: "הוספת הוצאה",
    editTitle: "עריכת הוצאה",
    descriptionLabel: "תיאור",
    descriptionPlaceholder: "לדוגמה: שכירות למשרד",
    amountLabel: "סכום (₪)",
    amountPlaceholder: "לדוגמה: 500",
    dateLabel: "תאריך",
    categoryLabel: "קטגוריה",
    notesLabel: "הערות",
    notesPlaceholder: "פרטים נוספים (אופציונלי)",
    saveButton: "שמירת הוצאה",
    saving: "שומר…",
    cancelButton: "ביטול",
    successAdd: "ההוצאה נוספה בהצלחה",
    successEdit: "ההוצאה עודכנה בהצלחה",
    successDelete: "ההוצאה נמחקה",
  },

  categories: {
    rent: "שכירות",
    materials: "חומרים",
    equipment: "ציוד",
    marketing: "שיווק",
    staff: "עובדים",
    utilities: "חשמל ומים",
    processing_fees: "סליקה ועמלות",
    software: "תוכנות",
    other: "אחר",
  },

  errors: {
    descriptionRequired: "יש למלא תיאור",
    amountRequired: "יש למלא סכום",
    amountInvalid: "הסכום אינו תקין",
    dateRequired: "יש לבחור תאריך",
    categoryRequired: "יש לבחור קטגוריה",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
    notFound: "ההוצאה לא נמצאה",
  },

  noRevenue: {
    title: "אין עדיין הכנסות בתקופה הזו.",
    body: "כשתורים יושלמו, ההכנסות יופיעו כאן.",
  },

  overspend: "ההוצאות גבוהות מההכנסות בתקופה הזו.",

  dashboardCard: {
    title: "כספים",
    revenue: "הכנסות",
    expenses: "הוצאות",
    profit: "רווח משוער",
    cta: "צפייה בכספים",
  },
} as const;

/** טקסטים לאוטומציית החזרת לקוחות בוואטסאפ */
export const WIN_BACK_AUTOMATION = {
  // ── סטטוס חיבור ──────────────────────────────────────────────────────────

  connectionSection: {
    title: "חיבור WhatsApp Business",
    notConnected: "שליחה אוטומטית דורשת חיבור WhatsApp Business",
    notConnectedBody:
      "כרגע ניתן לשלוח הודעות ידנית דרך וואטסאפ. שליחה אוטומטית תהיה זמינה לאחר חיבור ספק WhatsApp Business.",
    connectCta: "חיבור WhatsApp Business — בקרוב",
    connectedBadge: "מחובר",
    devModeBadge: "מצב פיתוח",
    devModeNote:
      "המערכת פועלת במצב פיתוח — הודעות לא נשלחות בפועל.",
    providerLabel: "ספק",
    phoneLabel: "מספר WhatsApp",
    // Phase 2A — real sending states
    realSendConnectedBadge: "מחובר לשליחה אמיתית",
    missingTemplateBadge: "חסרה תבנית מאושרת",
    missingTemplateBody:
      "נדרשת תבנית WhatsApp מאושרת בחשבון Meta Business כדי לשלוח הודעות אוטומטיות.",
    credentialsMissingBadge: "אישורי חיבור חסרים",
    credentialsMissingBody:
      "יש להגדיר את משתני הסביבה: META_WHATSAPP_ACCESS_TOKEN ו-META_WHATSAPP_PHONE_NUMBER_ID.",
    connectionErrorBadge: "שגיאת חיבור WhatsApp",
    // Phase 2A — test mode
    testModeBadge: "מצב בדיקה פעיל",
    testModeNote:
      "מצב בדיקה פעיל — הודעות אמיתיות נשלחות רק למספר הבדיקה שהוגדר.",
    testModeNoPhoneBadge: "מספר בדיקה לא מוגדר",
    testModeNoPhoneBody:
      "מצב בדיקה פעיל אך WHATSAPP_TEST_PHONE לא הוגדר. שליחה נחסמת לכולם.",
  },

  // ── פאנל סטטוס אוטומציה ────────────────────────────────────────────────

  statusPanel: {
    title: "החזרת לקוחות אוטומטית",
    subtitle: "המערכת תשלח הודעות לקוחות שלא חזרו — בלי שתצטרכי לעשות כלום.",

    disabled: "האוטומציה כבויה",
    disabledCta: "הפעלת אוטומציה",
    enabled: "האוטומציה פעילה",
    noProvider: "נדרש חיבור WhatsApp",
    manualFallback: "שליחה ידנית זמינה תמיד",

    eligibleNow: (n: number) =>
      n === 1 ? "לקוחה אחת כעת מתאימה לקבלת הודעה" : `${n} לקוחות כעת מתאימות לקבלת הודעה`,
    sentThisMonth: (n: number) =>
      n === 0 ? "לא נשלחו הודעות החודש" : `${n} הודעות נשלחו החודש`,
    failedThisMonth: (n: number) => `${n} נכשלו`,
    lastRun: "ריצה אחרונה",
    neverRun: "עוד לא הופעלה",
    nextSend: (hour: number) => `שליחה יומית בשעה ${hour}:00`,
    threshold: (days: number) => `${days} ימים ללא תור`,

    runNow: "הפעלה ידנית עכשיו",
    running: "מריץ…",
    runSuccess: (sent: number, skipped: number) =>
      `הסתיים — ${sent} נשלחו, ${skipped} דולגו`,
    runFailed: "הריצה נכשלה. יש לנסות שוב.",
  },

  // ── טופס הגדרות ──────────────────────────────────────────────────────────

  settings: {
    sectionTitle: "הגדרות אוטומציה",
    sectionSubtitle: "הגדירי מתי ואיך לשלוח הודעות החזרה ללקוחות.",

    enableLabel: "הפעלת שליחה אוטומטית",
    enableHelper:
      "כאשר מופעל, המערכת תשלח הודעות אוטומטית ללקוחות שלא חזרו.",
    enableLockedHelper:
      "שליחה אוטומטית תיפתח רק לאחר חיבור מספר עסקי, אישור תבנית עברית והפעלת cron.",

    thresholdLabel: "מתי כדאי לנסות להחזיר לקוחה?",
    thresholdUnit: "ימים",
    thresholdCustom: "מותאם אישית",
    thresholdCustomInputLabel: "מספר ימים ללא תור",
    thresholdCustomPlaceholder: "לדוגמה: 45",
    thresholdCustomError: "יש להזין מספר ימים תקין",
    thresholdApply: "החל",
    presetDays: [30, 60, 90] as const,

    sendTimeLabel: "מתי לשלוח את ההודעה?",
    sendTimeMorning: "בבוקר (9:00)",
    sendTimeNoon: "בצהריים (12:00)",
    sendTimeEvening: "בערב (18:00)",
    sendTimeCustom: "שעה מותאמת אישית",
    sendTimeCustomLabel: "שעת שליחה (0–23)",

    templateLabel: "תוכן ההודעה",
    templateHelper: "ניתן להשתמש במשתנים: {שם}, {שם_העסק}, {שירות_אחרון}, {הטבה}",
    templatePlaceholder:
      "היי {שם}, עבר זמן מה מאז הביקור האחרון שלך ב{שירות_אחרון} אצל {שם_העסק}.\n{הטבה}\nנשמח לראות אותך שוב ❤️",
    templateReset: "איפוס לברירת מחדל",
    messagePreviewTitle: "תצוגה מקדימה של ההודעה",
    messagePreviewNote: "הדוגמה מציגה את ההודעה בנתוני לקוחה לדוגמה — הפרטים יוחלפו בנתוני הלקוחה האמיתית",

    offerLabel: "הטבה לכלול בהודעה",
    offerNone: "ללא הטבה",
    offerDiscount10: "10% הנחה לתור הבא",
    offerUpgrade: "שדרוג טיפול מתנה",
    offerSpecialSlot: "תור פנוי מיוחד",
    offerCustom: "הטבה מותאמת אישית",
    offerCustomLabel: "תוכן ההטבה",
    offerCustomPlaceholder: "לדוגמה: קפה מתנה בתור הבא ☕",

    cooldownLabel: "מינימום ימים בין הודעות לאותה לקוחה",
    cooldownUnit: "ימים",
    cooldownHelper: "מונע שליחת הודעות כפולות ותחושת ספאם.",

    requireOptInLabel: "שלחי רק ללקוחות שאישרו קבלת הודעות WhatsApp",
    requireOptInHelper:
      "מומלץ. ניתן לעדכן הסכמה בפרופיל הלקוחה.",

    // Phase 2A — Meta template configuration
    templateSection: "תבנית Meta מאושרת (לשליחה אמיתית)",
    templateSectionNote:
      "נדרש רק לשליחה אוטומטית אמיתית דרך Meta WhatsApp Cloud API. לא רלוונטי במצב פיתוח.",
    templateNameLabel: "שם תבנית מאושרת",
    templateNamePlaceholder: "לדוגמה: win_back_v1",
    templateNameHelper:
      "השם חייב להתאים לתבנית מאושרת בחשבון Meta Business שלך. משתני התבנית: {{1}} שם לקוחה, {{2}} שם עסק, {{3}} שירות אחרון, {{4}} הטבה.",
    templateLanguageLabel: "קוד שפת התבנית",
    templateLanguagePlaceholder: "he",
    templateLanguageHelper: "ברירת מחדל: he. אם Meta מחייב — נסי he_IL. לדוגמה: en, ar, he, he_IL.",
    templateMissingWarning: "תבנית WhatsApp מאושרת נדרשת לשליחה אמיתית.",

    saveButton: "שמירת הגדרות",
    saving: "שומר…",
    saved: "ההגדרות נשמרו",
    saveError: "שמירה נכשלה. יש לנסות שוב.",
  },

  // ── סטטוס מוגן — אפשרויות שליחה ─────────────────────────────────────────

  modeBanner: {
    manualTitle: "שליחה ידנית בוואטסאפ",
    manualBody:
      "בחרי לקוחה, הכיני הודעה והעתיקי אותה לשליחה ידנית בוואטסאפ.",
    autoTitle: "שליחה אוטומטית",
    autoBody:
      "המערכת מזהה לקוחות מתאימות ושולחת הודעות אוטומטית לפי ההגדרות שלך.",
    autoLockedTitle: "שליחה אוטומטית — נעול",
    autoLockedBody:
      "נדרש חיבור WhatsApp Business לפני הפעלת שליחה אוטומטית.",
  },

  // ── כרטיס בעמוד אוטומציות ─────────────────────────────────────────────────

  automationsCard: {
    title: "החזרת לקוחות אוטומטית",
    subtitle: "שלחי הודעות וואטסאפ אוטומטיות ללקוחות שלא חזרו.",
    manageCta: "ניהול אוטומציה",
    statusEnabled: "פעיל",
    statusDisabled: "כבוי",
    statusNoProvider: "נדרש חיבור",
    thresholdBadge: (days: number) => `${days} ימים`,
    sentBadge: (n: number) => `${n} נשלחו`,
  },

  // ── אדמין ─────────────────────────────────────────────────────────────────

  admin: {
    sectionTitle: "אוטומציית WhatsApp",
    whatsappConnected: "WhatsApp מחובר",
    whatsappNotConnected: "WhatsApp לא מחובר",
    automationEnabled: "אוטומציה פעילה",
    automationDisabled: "אוטומציה כבויה",
    realSentThisMonth: "נשלחו בפועל החודש",
    mockRunsThisMonth: "הרצות בדיקה החודש",
    failedThisMonth: "נכשלו החודש",
    skippedThisMonth: "דולגו החודש",
    lastRun: "ריצה אחרונה",
    // Phase 2A additions
    provider: "ספק",
    phoneNumber: "מספר WhatsApp",
    realSendEnabled: "שליחה אמיתית",
    credentialsConfigured: "אישורי Meta",
    templateConfigured: "תבנית מאושרת",
    lastFailureReason: "סיבת כישלון אחרונה",
    yes: "מוגדר",
    no: "לא מוגדר",
    active: "פעיל",
    inactive: "לא פעיל",
  },

  // ── אישור הרצה ────────────────────────────────────────────────────────────

  runConfirm: {
    title: "אישור הרצת בדיקה",
    body: "המערכת תבדוק לקוחות מתאימות ותכין שליחה לפי ההגדרות. במצב הנוכחי לא תישלח הודעה אמיתית ללא ספק WhatsApp מחובר.",
    confirm: "אישור ביצוע",
    cancel: "ביטול",
    runTestLabel: "הרצת בדיקה",
    runRealLabel: "הפעלת שליחה עכשיו",
    // Phase 2A — test mode confirmation
    testModeTitle: "אישור שליחת בדיקה",
    testModeBody:
      "המערכת תשלח הודעת WhatsApp אמיתית רק למספר הבדיקה שהוגדר. לקוחות אחרות לא יקבלו הודעה. להמשיך?",
    testModeConfirm: "כן, שלח למספר הבדיקה",
    testModeRunLabel: "שליחת בדיקה למספר הבדיקה",
    // Phase 2A — real send confirmation
    realSendTitle: "אישור שליחה אמיתית",
    realSendBody:
      "המערכת תשלח הודעות WhatsApp אמיתיות ללקוחות המתאימות לפי ההגדרות. לא ניתן לבטל הודעות שנשלחו. להמשיך?",
    realSendConfirm: "כן, לשלוח עכשיו",
  },

  // ── פירוט לקוחות שנבדקו ──────────────────────────────────────────────────

  breakdown: {
    title: "פירוט בדיקת לקוחות",
    total: "לקוחות שנבדקו",
    eligible: "מתאימות לשליחה",
    skippedHeader: "דולגו:",
    noCompletedBooking: "אין ביקור קודם שהושלם",
    hasFutureBooking: "יש תור עתידי",
    noOptIn: "אין אישור WhatsApp",
    invalidPhone: "מספר טלפון לא תקין",
    inCooldown: "כבר קיבלו הודעה לאחרונה",
  },

  // ── הסבר אפס לקוחות מתאימות ──────────────────────────────────────────────

  zeroEligible: {
    title: "אין לקוחות מתאימות לשליחה אוטומטית",
    noOptInReason:
      "אין לקוחות מתאימות לשליחה אוטומטית כי לא סומן אישור לקבלת הודעות WhatsApp.",
    noOptInHelper:
      "ניתן להפעיל מצב ידני או לעדכן אישור בפרופיל הלקוחה.",
    manualLink: "מעבר לשליחה ידנית",
  },

  // ── מצב שליחה בכרטיסי הודעות ────────────────────────────────────────────

  messageBadge: {
    realSent: "נשלח באמת",
    mockSent: "מצב פיתוח — לא נשלח בפועל",
    failed: "נכשל",
    skipped: "דולג",
  },

  // ── הצהרת ציות ────────────────────────────────────────────────────────────

  complianceNote:
    "שליחה אוטומטית תישלח רק ללקוחות שאישרו קבלת הודעות WhatsApp מהעסק.",

  // ── רשימת תצורה (Phase 2A) ────────────────────────────────────────────────

  setupChecklist: {
    title: "הגדרת חיבור WhatsApp אמיתי",
    subtitle: "כל הפריטים חייבים להיות ירוקים כדי לבצע שליחת בדיקה.",
    providerConfigured: "ספק מוגדר",
    credentialsConfigured: "פרטי Meta קיימים",
    testPhoneConfigured: "מספר בדיקה מוגדר",
    templateConfigured: "תבנית מאושרת מוגדרת",
    testModeActive: "מצב בדיקה פעיל",
    realSendEnabled: "שליחה אמיתית מופעלת",
    readyToTest: "ניתן לבצע שליחת בדיקה",
    notReady: "חסרות הגדרות — לא ניתן לשלוח",
    // Phase 2B — production readiness milestones
    productionReadinessTitle: "התקדמות לקראת שליחה אמיתית",
    sandboxTestPassed: "שליחת בדיקה בוצעה בהצלחה",
    sandboxTestPending: "ממתין לשליחת בדיקה ראשונה",
    hasRealBusinessPhone: "מספר טלפון עסקי רשום ב-Meta",
    awaitingBusinessPhone: "ממתין לרישום מספר טלפון עסקי",
    hebrewTemplateConfigured: "תבנית עברית מאושרת מוגדרת",
    awaitingHebrewTemplate: "ממתין לאישור תבנית עברית",
    webhooksConfigured: "Meta Webhooks מוגדרים",
    awaitingWebhooks: "ממתין להגדרת Meta Webhooks",
    cronEnabled: "שליחה יומית אוטומטית (cron) פעילה",
    awaitingCron: "ממתין להפעלת שליחה יומית אוטומטית",
    unsubscribeReady: "ניהול הסרה (STOP) מוגדר",
    awaitingUnsubscribe: "ממתין להגדרת ניהול הסרה",
    testSendNote: "ההודעה תישלח רק אל מספר הבדיקה שהוגדר — לא ללקוחות",
  },

  // ── שליחת בדיקה (Phase 2A.1) ─────────────────────────────────────────────

  testSend: {
    buttonLabel: "שליחת בדיקה למספר שלי",
    sending: "שולח…",
    successTitle: "הודעת בדיקה נשלחה",
    successBody: "הודעת בדיקה נשלחה בהצלחה למספר הבדיקה.",
    providerMessageIdLabel: "מזהה הודעה:",
    failureTitle: "השליחה נכשלה",
    errorMissingTestMode: "מצב בדיקה (WHATSAPP_TEST_MODE=true) לא מופעל",
    errorMissingTestPhone: "מספר בדיקה (WHATSAPP_TEST_PHONE) לא מוגדר",
    errorMissingRealSend: "שליחה אמיתית (ENABLE_REAL_WHATSAPP_SEND=true) לא מופעלת",
    errorMissingProvider: "ספק WhatsApp לא מוגדר (WHATSAPP_PROVIDER=meta_cloud_api)",
    errorMissingCredentials: "פרטי Meta חסרים (TOKEN / PHONE_NUMBER_ID)",
    errorMissingTemplate: "תבנית WhatsApp מאושרת לא מוגדרת בהגדרות",
    errorProviderError: "שגיאה בשליחה דרך Meta API",
    errorGeneric: "שגיאה פנימית. יש לנסות שוב.",
  },
} as const;

/** טקסטים לסליקה ותשלומים בהזמנה */
export const PAYMENTS = {
  // ── הגדרות בעל/ת העסק ────────────────────────────────────────────────────
  settings: {
    sectionTitle: "סליקה ותשלומים",
    sectionHint:
      "אפשר ללקוחות לשלם תשלום מלא אונליין בזמן קביעת התור בעמוד הציבורי.",

    enableLabel: "אפשר תשלום אונליין",
    enableHint:
      "כשמכובה, ההזמנה הציבורית נשארת בדיוק כמו היום — בלי שלב תשלום.",

    notConnectedTitle: "סליקה עדיין לא מחוברת",
    notConnectedBody:
      "אפשר להגדיר את מדיניות התשלום, אבל תשלומים אמיתיים לא יופעלו עד חיבור ספק סליקה.",

    requirementLabel: "דרישת תשלום בהזמנה",
    requirement: {
      none: "ללא תשלום",
      full_payment: "תשלום מלא",
    },

    allowPayAtBusinessLabel: "אפשר תשלום במקום",
    allowPayAtBusinessHint:
      "הלקוחה תוכל לבחור לשלם בעסק במקום לשלם עכשיו אונליין.",

    providerLabel: "ספק סליקה",
    provider: {
      mock: "מצב בדיקה (ללא כסף אמיתי)",
      payplus: "PayPlus",
      grow_meshulam: "Grow / משולם",
      tranzila: "Tranzila",
      disabled: "מושבת",
    },

    instructionsLabel: "הערת תשלום ללקוחה (לא חובה)",
    instructionsPlaceholder: "לדוגמה: התשלום אינו מוחזר בביטול פחות מ־24 שעות.",

    save: "שמירת הגדרות",
    success: "הגדרות התשלום נשמרו",

    connectionActive: "ספק הסליקה מחובר",
    connectionNotConnected: "ספק הסליקה לא מחובר — תשלומים אמיתיים מושבתים",
    connectionError: "יש בעיה בחיבור ספק הסליקה",
  },

  errors: {
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
    amountTooLow: "סכום התשלום אינו תקין",
    paymentsDisabled: "התשלומים אינם פעילים בעסק זה",
    notConfigured: "מדיניות התשלום אינה מוגדרת במלואה",
    providerError: "אירעה שגיאה ביצירת קישור התשלום. אפשר לנסות שוב.",
  },

  // ── שלב התשלום בעמוד הציבורי ─────────────────────────────────────────────
  publicStep: {
    optionalTitle: "אפשר לשלם עכשיו או לשלם במקום",
    fullTitle: "לתור זה נדרש תשלום מלא מראש",

    fullAmountLabel: "סה״כ לתשלום",

    payNow: "תשלום עכשיו",
    payAtBusiness: "אשלם במקום",
    paySecure: "לתשלום מאובטח",

    trustHostedPage: "התשלום מתבצע בעמוד מאובטח של ספק הסליקה",
    trustNoCardStored: "Allura לא שומרת פרטי אשראי",

    submitNote: "הבקשה תישלח לעסק לאישור. התור יאושר לאחר שהתשלום יתקבל.",

    redirecting: "מעבירים אותך לעמוד התשלום המאובטח…",
  },

  // ── מסך חזרה מהתשלום ─────────────────────────────────────────────────────
  returnStatus: {
    successTitle: "התשלום התקבל והתור נקבע",
    successBody: "תודה! קיבלנו את התשלום והבקשה לתור נשלחה לעסק.",
    failureTitle: "התשלום לא הושלם",
    failureBody:
      "אפשר לנסות שוב, או לבחור תשלום במקום אם העסק מאפשר זאת.",
    pendingTitle: "התשלום בעיבוד",
    pendingBody: "נעדכן את סטטוס התור ברגע שהתשלום יאומת.",
    backToBusiness: "חזרה לעמוד העסק",
  },

  // ── מסך אישור התור בעמוד הציבורי (חזרה מהתשלום) ───────────────────────────
  successState: {
    titleBooked: "התור נקבע בהצלחה",
    titlePaid: "התשלום התקבל והתור נקבע",
    confirmation: "תודה! פרטי התור נשלחו לעסק.",

    detailsHeading: "פרטי התור",
    businessLabel: "העסק",
    serviceLabel: "שירות",
    dateLabel: "תאריך",
    timeLabel: "שעה",
    nameLabel: "שם",
    phoneLabel: "טלפון",
    paymentLabel: "תשלום",

    paymentPaid: "שולם",
    paymentPending: "ממתין לתשלום",
    paymentAtBusiness: "תשלום במקום",

    addToCalendar: "הוספה ליומן",
    openWhatsApp: "שליחה בוואטסאפ",
    backToBusiness: "חזרה לעמוד העסק",

    saveNote: "מומלץ לשמור את פרטי התור ביומן.",

    pendingTitle: "התשלום עדיין בבדיקה",
    pendingBody:
      "התור נשמר וממתין לאישור העסק. נעדכן את סטטוס התשלום ברגע שיתקבל אישור מספק הסליקה.",
    pendingRefresh: "רענון הסטטוס",

    failedTitle: "התשלום לא הושלם",
    failedBody:
      "התשלום לא בוצע. אפשר לנסות שוב, או לחזור לעמוד העסק ולקבוע מחדש.",
    retry: "חזרה לעמוד העסק",

    whatsappMessage: "היי! קבעתי תור ל{service} אצל {business} ב{date} בשעה {time} 🎉",
  },

  // ── תווית סטטוס תשלום (תצוגת בעל/ת העסק) ─────────────────────────────────
  ownerStatus: {
    not_required: "לא נדרש תשלום",
    pending: "ממתין לתשלום",
    payment_link_created: "ממתין לתשלום",
    paid: "שולם",
    failed: "נכשל",
    cancelled: "בוטל",
    expired: "פג תוקף",
    refunded: "הוחזר",
    pay_at_business: "תשלום במקום",
  },
} as const;
