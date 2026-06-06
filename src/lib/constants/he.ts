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

/** טקסטים של עמוד הבית */
export const HOME = {
  heading: "Beautiq",
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
  greeting: "שלום",
  /** כותרת משנה בכותרת האפליקציה */
  headerSubtitle: "המערכת שלך לניהול תורים ולקוחות",
  /** כותרת כאשר עדיין אין עסק */
  headerNoBusinessTitle: "הגדרת העסק שלך",

  /** מצב א׳ — משתמש מחובר שעדיין אין לו עסק: כרטיס הקמת העסק */
  setup: {
    title: "ברוכים הבאים ל־Beautiq",
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

  /** התראת מקדמות ממתינות */
  pendingDeposits: {
    alertSingular: "תור אחד ממתין לאישור מקדמה",
    alertPluralSuffix: "תורים ממתינים לאישור מקדמה",
    expandHint: "לפרטים ▼",
    collapseHint: "סגירה ▲",
    markPaid: "שולמה ✓",
    marking: "מסמן…",
    viewDetails: "פרטים",
    deposit: "מקדמה",
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
    sectionDeposit: "מקדמה",
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

    requiresDepositLabel: "נדרשת מקדמה לקביעת תור",
    depositHint: "מקדמה עוזרת לצמצם ביטולים. בשלב הזה המעקב ידני.",
    depositAmountLabel: "סכום מקדמה",
    depositAmountPlaceholder: "לדוגמה: 50",

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
    deposit: "מקדמה",
    noDeposit: "לא נדרשת",
    active: "פעיל",
    inactive: "לא פעיל",
    editButton: "עריכה",
    deactivateButton: "השבתה",
    activateButton: "הפעלה",
  },

  errors: {
    nameRequired: "יש למלא שם שירות",
    durationRequired: "יש לבחור משך טיפול",
    durationInvalid: "משך הטיפול אינו תקין",
    priceRequired: "יש למלא מחיר",
    priceInvalid: "המחיר אינו תקין",
    depositAmountRequired: "יש למלא סכום מקדמה",
    depositAmountInvalid: "סכום המקדמה אינו תקין",
    depositHigherThanPrice: "סכום המקדמה לא יכול להיות גבוה ממחיר השירות",
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
    overlapHelper: "המערכת תבדוק שאין תור אחר באותה שעה",
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
  },

  errors: {
    notFound: "הלקוחה לא נמצאה",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לניהול מקדמות */
export const DEPOSITS = {
  sectionTitle: "מקדמה",

  status: {
    not_required: "לא נדרשת",
    pending: "ממתינה",
    paid: "שולמה",
    failed: "נכשלה",
    refunded: "הוחזרה",
  },

  labels: {
    status: "סטטוס מקדמה",
    amount: "סכום מקדמה",
    paidAt: "תאריך אישור תשלום",
    refundedAt: "תאריך החזר",
  },

  actions: {
    markPaid: "סימון כמקדמה שולמה",
    markRefunded: "סימון כהוחזרה",
    markPending: "סימון כממתינה",
  },

  success: {
    markedPaid: "המקדמה סומנה כשולמה",
    markedRefunded: "המקדמה סומנה כהוחזרה",
    markedPending: "המקדמה סומנה כממתינה",
  },

  errors: {
    notFound: "לא נמצאה מקדמה לתור הזה",
    notAllowed: "לא ניתן לעדכן מקדמה לתור הזה",
    invalidTransition: "הפעולה המבוקשת אינה אפשרית עבור הסטטוס הנוכחי",
    generic: "משהו השתבש. יש לנסות שוב בעוד רגע",
  },
} as const;

/** טקסטים לניהול הודעות וואטסאפ */
export const MESSAGES = {
  pageTitle: "הודעות",
  pageSubtitle:
    "הכינו הודעות מוכנות ללקוחות לפי תורים, מקדמות ומצבים נפוצים",
  explanation:
    "ההודעות לא נשלחות אוטומטית. Beautiq מכינה ניסוח מוכן, ואתם מעתיקים ושולחים בוואטסאפ.",
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
      deposit_request: "בקשת מקדמה",
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
    depositAmount: "סכום מקדמה",
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
    pendingDeposits: {
      title: "יש תורים עם מקדמה ממתינה",
      body: "יש תורים שנקבעו עם מקדמה שעדיין לא סומנה כשולמה.",
      action: "צפייה בתורים",
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
      body: "כדאי לשים לב ללקוחות שלא הגיעו בעבר ולשקול לבקש מקדמה בתורים הבאים.",
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
    hint: "כאן אפשר להגדיר כללים בסיסיים לביטולים ומקדמות. בהמשך נשתמש בזה גם בהודעות מוכנות ובקישור הזמנה פשוט.",
    policyTextLabel: "טקסט מדיניות",
    policyTextPlaceholder: "לדוגמה: ביטול עד 24 שעות לפני התור — ללא חיוב. ביטול מאוחר יותר — חיוב מלא.",
    minNoticeHoursLabel: "שעות התראה מינימליות לביטול ללא חיוב",
    minNoticeHoursPlaceholder: "לדוגמה: 24",
    requireDepositLabel: "נדרשת מקדמה כברירת מחדל לתורים חדשים",
    requireDepositHint: "הגדרה עתידית — כרגע המקדמה מוגדרת ברמת השירות בלבד ואינה מושפעת מהגדרה זו.",
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
    depositNote: "נדרשת מקדמה — התשלום יתואם מול העסק",

    clientNameLabel: "שם מלא",
    clientNamePlaceholder: "לדוגמה: נועה כהן",
    phoneLabel: "טלפון",
    phonePlaceholder: "050-0000000",
    noteLabel: "הערה קצרה",
    notePlaceholder: "אם יש משהו שחשוב לדעת…",
    noteOptional: "אופציונלי",

    dateLabel: "תאריך מבוקש",
    timeLabel: "שעה מבוקשת",

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
