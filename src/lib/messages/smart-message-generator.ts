export type MessageScenario =
  | "booking_confirmation"
  | "booking_reminder"
  | "deposit_request"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "after_treatment"
  | "rebook_reminder"
  | "no_show_followup"
  | "not_returned";

export type MessageTone = "regular" | "warm" | "concise";

export interface GeneratorContext {
  businessName: string;
  clientName?: string;
  serviceName?: string;
  bookingDate?: string;
  bookingTime?: string;
  price?: string;
  depositAmount?: string;
}

export interface GeneratorResult {
  body: string | null;
  missingContext: string[];
}

// Fills {variable} placeholders from context.
function fill(template: string, ctx: GeneratorContext): string {
  return template
    .replace(/\{businessName\}/g, ctx.businessName)
    .replace(/\{clientName\}/g, ctx.clientName ?? "")
    .replace(/\{serviceName\}/g, ctx.serviceName ?? "")
    .replace(/\{bookingDate\}/g, ctx.bookingDate ?? "")
    .replace(/\{bookingTime\}/g, ctx.bookingTime ?? "")
    .replace(/\{price\}/g, ctx.price ?? "")
    .replace(/\{depositAmount\}/g, ctx.depositAmount ?? "");
}

type ToneTemplates = Record<MessageTone, string>;

const SCENARIO_CONFIG: Record<
  MessageScenario,
  { requires: (keyof GeneratorContext)[]; missingMsg: string; templates: ToneTemplates }
> = {
  booking_confirmation: {
    requires: ["clientName", "serviceName", "bookingDate", "bookingTime"],
    missingMsg: "כדי להכין אישור תור, יש לבחור תור קיים.",
    templates: {
      regular:
        "היי {clientName}, התור שלך ל־{serviceName} אצל {businessName} נקבע ל־{bookingDate} בשעה {bookingTime}.\nנשמח לראות אותך ❤️",
      warm:
        "היי {clientName}! שמחים לאשר את התור שלך ל־{serviceName} אצל {businessName}.\nהתור נקבע ל־{bookingDate} בשעה {bookingTime}.\nמחכים לך ❤️",
      concise:
        "היי {clientName}, תור {serviceName} נקבע ל־{bookingDate} בשעה {bookingTime} אצל {businessName}. נתראה!",
    },
  },
  booking_reminder: {
    requires: ["clientName", "serviceName", "bookingDate", "bookingTime"],
    missingMsg: "כדי להכין תזכורת לתור, יש לבחור תור קיים.",
    templates: {
      regular:
        "היי {clientName}, תזכורת: יש לך תור ל־{serviceName} אצל {businessName} ב־{bookingDate} בשעה {bookingTime}.\nמחכים לך ❤️",
      warm:
        "היי {clientName}! רצינו להזכיר לך שיש לך תור ל־{serviceName} אצל {businessName} ב־{bookingDate} בשעה {bookingTime}.\nאם משהו השתנה, אפשר לפנות אלינו. נתראה ❤️",
      concise:
        "היי {clientName}, תזכורת לתור {serviceName} ב־{bookingDate} בשעה {bookingTime}.",
    },
  },
  deposit_request: {
    requires: ["clientName", "serviceName", "bookingDate", "depositAmount"],
    missingMsg: "כדי להכין בקשת מקדמה, יש לבחור תור שמחייב מקדמה.",
    templates: {
      regular:
        "היי {clientName}, כדי לשמור את התור שלך ל־{serviceName} בתאריך {bookingDate}, יש צורך במקדמה של {depositAmount}.\nאחרי התשלום התור יישמר במערכת. תודה ❤️",
      warm:
        "היי {clientName}! שמחים שקבעת תור ל־{serviceName} ב־{bookingDate} אצל {businessName}.\nכדי לשמור את המקום, נשמח לקבל מקדמה של {depositAmount}.\nתודה רבה ❤️",
      concise:
        "היי {clientName}, לשמירת תור {serviceName} ב־{bookingDate} נדרשת מקדמה: {depositAmount}.",
    },
  },
  booking_cancelled: {
    requires: ["clientName", "serviceName", "bookingDate"],
    missingMsg: "כדי להכין הודעת ביטול, יש לבחור תור קיים.",
    templates: {
      regular:
        "היי {clientName}, התור שלך ל־{serviceName} אצל {businessName} שנקבע ל־{bookingDate} בוטל.\nאם תרצי לקבוע מועד חדש, נשמח לעזור.",
      warm:
        "היי {clientName}, ביטלנו את התור ל־{serviceName} ב־{bookingDate} אצל {businessName}.\nנשמח מאוד לקבוע לך מועד חדש שיתאים. אנחנו כאן בשבילך ❤️",
      concise:
        "היי {clientName}, התור ל־{serviceName} ב־{bookingDate} בוטל. לקביעת מועד חדש — ניתן לפנות.",
    },
  },
  booking_rescheduled: {
    requires: ["clientName", "serviceName", "bookingDate", "bookingTime"],
    missingMsg: "כדי להכין הודעת שינוי מועד, יש לבחור תור קיים.",
    templates: {
      regular:
        "היי {clientName}, המועד של התור שלך ל־{serviceName} אצל {businessName} שונה ל־{bookingDate} בשעה {bookingTime}.\nמחכים לך ❤️",
      warm:
        "היי {clientName}! עדכנו את המועד לתור שלך ל־{serviceName} אצל {businessName}.\nהתור החדש נקבע ל־{bookingDate} בשעה {bookingTime}.\nנשמח לראות אותך ❤️",
      concise:
        "היי {clientName}, תור {serviceName} הוזז ל־{bookingDate} בשעה {bookingTime}.",
    },
  },
  after_treatment: {
    requires: ["clientName", "serviceName"],
    missingMsg: "כדי להכין הודעה אחרי טיפול, יש לבחור תור שהושלם.",
    templates: {
      regular:
        "היי {clientName}, תודה שבאת לטיפול {serviceName} אצל {businessName}.\nנשמח לראות אותך שוב ❤️",
      warm:
        "היי {clientName}! תודה רבה שבחרת להגיע לטיפול {serviceName} אצל {businessName}.\nנשמח לשמוע איך היה הטיפול ולראות אותך שוב בקרוב ❤️",
      concise:
        "היי {clientName}, תודה על הביקור ב{businessName}! נשמח לראותך שוב.",
    },
  },
  rebook_reminder: {
    requires: ["clientName"],
    missingMsg: "כדי להכין תזכורת לקביעת תור חוזר, יש לבחור לקוחה.",
    templates: {
      regular:
        "היי {clientName}, עבר זמן מה מאז התור האחרון שלך אצל {businessName}.\nאם תרצי לקבוע תור נוסף, נשמח למצוא לך מועד שמתאים לך ❤️",
      warm:
        "היי {clientName}! הזמן עובר מהר — כבר חלף זמן מאז הביקור האחרון שלך אצל {businessName}.\nנשמח מאוד לראותך שוב, אם תרצי לקבוע תור — אנחנו כאן ❤️",
      concise:
        "היי {clientName}, עבר זמן מאז הביקור האחרון אצל {businessName}. רוצה לקבוע תור?",
    },
  },
  no_show_followup: {
    requires: ["clientName"],
    missingMsg: "כדי להכין הודעת אי הגעה, יש לבחור לקוחה.",
    templates: {
      regular:
        "היי {clientName}, ראינו שלא הגעת לתור שנקבע אצל {businessName}.\nאם תרצי לקבוע מועד חדש, נשמח לעזור.",
      warm:
        "היי {clientName}, שמנו לב שלא הגעת לתור אצל {businessName}.\nמקווים שהכל בסדר! אם תרצי לקבוע מועד חדש שנוח לך, נשמח לעזור ❤️",
      concise:
        "היי {clientName}, לא ראינו אותך בתור. רוצה לקבוע מועד חדש?",
    },
  },
  not_returned: {
    requires: ["clientName"],
    missingMsg: "כדי להכין הודעה ללקוחה שלא חזרה, יש לבחור לקוחה.",
    templates: {
      regular:
        "היי {clientName}, לא נפגשנו כבר הרבה זמן אצל {businessName}.\nאם תרצי לחדש, נשמח למצוא לך מועד שמתאים.",
      warm:
        "היי {clientName}! הרבה זמן עבר מאז ראינו אותך אצל {businessName}, ואנחנו מתגעגעים!\nאם תרצי לקבוע תור, נשמח לעזור ❤️",
      concise:
        "היי {clientName}, מתגעגעים אצל {businessName}! רוצה לקבוע תור?",
    },
  },
};

/**
 * Generate a Hebrew WhatsApp-ready message for a given scenario, context, and tone.
 * Returns null body + missingContext array if required context is absent.
 * Structured so the template section can be swapped for an AI/LLM call in the future.
 */
export function generateMessage(
  scenario: MessageScenario,
  context: GeneratorContext,
  tone: MessageTone = "regular",
): GeneratorResult {
  const config = SCENARIO_CONFIG[scenario];

  for (const field of config.requires) {
    if (!context[field]) {
      return { body: null, missingContext: [config.missingMsg] };
    }
  }

  return {
    body: fill(config.templates[tone], context),
    missingContext: [],
  };
}
