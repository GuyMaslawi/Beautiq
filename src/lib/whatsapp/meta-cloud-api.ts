/**
 * Meta WhatsApp Cloud API provider.
 *
 * Sends approved WhatsApp template messages via the Graph API.
 * Only instantiated when ENABLE_REAL_WHATSAPP_SEND=true and credentials are present.
 *
 * Graph API endpoint: POST /{phone-number-id}/messages
 * Phone numbers must be in E.164 format WITHOUT the leading '+' (e.g. 972501234567).
 *
 * SAFETY: Never log the access token or any credentials.
 */

import type {
  WhatsAppProvider,
  SendMessageParams,
  SendMessageResult,
  MetaErrorDetails,
} from "./provider";
import { maskPhone } from "@/lib/phone";
import { expectedTemplateVariableCount } from "@/lib/whatsapp/default-templates";
import { captureError } from "@/lib/logger";

const META_GRAPH_BASE = "https://graph.facebook.com";

interface MetaProviderConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}

interface MetaMessageResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    /** Meta request trace id — safe to surface, helps debugging with Meta support */
    fbtrace_id?: string;
    error_data?: { details?: string };
  };
}

/**
 * Builds an owner/admin-safe failure reason from a Meta error. Includes the
 * human message plus the diagnostic fields (code / type / error_subcode /
 * fbtrace_id) so the audit trail explains exactly why Meta rejected the send.
 * NEVER includes the access token or any credential — only Meta's own error
 * fields, which are safe to display.
 */
export function buildMetaErrorReason(
  error: MetaErrorResponse["error"] | undefined,
  httpStatus: number,
): string {
  const message = error?.message ?? `Meta API שגיאה ${httpStatus}`;
  const parts: string[] = [];
  if (typeof error?.code === "number") parts.push(`code ${error.code}`);
  if (error?.type) parts.push(`type ${error.type}`);
  if (typeof error?.error_subcode === "number") parts.push(`subcode ${error.error_subcode}`);
  if (error?.fbtrace_id) parts.push(`trace ${error.fbtrace_id}`);
  return parts.length > 0 ? `${message} [${parts.join(" · ")}]` : message;
}

/**
 * Extracts the structured Meta error fields for persistence/display. Only Meta's
 * own diagnostic fields are kept — there is never a token or header here, so the
 * sanitized raw is just the error object itself. Returns undefined when there is
 * no error object to describe.
 */
export function buildMetaErrorDetails(
  error: MetaErrorResponse["error"] | undefined,
): MetaErrorDetails | undefined {
  if (!error) return undefined;
  return {
    code: typeof error.code === "number" ? error.code : undefined,
    subcode: typeof error.error_subcode === "number" ? error.error_subcode : undefined,
    type: error.type,
    fbtraceId: error.fbtrace_id,
    // error.* contains only Meta diagnostic fields — no credential is ever present.
    rawSanitized: JSON.stringify({
      message: error.message,
      type: error.type,
      code: error.code,
      error_subcode: error.error_subcode,
      fbtrace_id: error.fbtrace_id,
      error_data: error.error_data,
    }),
  };
}

// ---------------------------------------------------------------------------
// התראות על כשל שליחה
// ---------------------------------------------------------------------------

/**
 * שגיאות ברמת הנמען הבודד: הלקוחה אינה בוואטסאפ, המכשיר שלה לא הצליח לקבל,
 * וכדומה. אלה אינן מעידות על תקלה במערכת — הן ייכתבו ל-AutomationMessage
 * ויוצגו לבעלת העסק, אבל אסור שיפיקו התראה, אחרת כל יום עבודה רגיל מייצר רעש
 * ומאמן אותנו להתעלם מהתיבה בדיוק כשתגיע ההתראה שכן חשובה.
 */
const RECIPIENT_LEVEL_ERROR_CODES = new Set([131026, 131047, 131051, 131052, 131053]);

/**
 * ממפה שגיאת Meta ל-scope של התראה, או ל-null כשאין להתריע.
 *
 * ה-scope הוא גם מפתח ההשתקה של הלוגר (התראה אחת לכל scope בכל חמש דקות),
 * ולכן החלוקה היא לפי *סוג התקלה* ולא לפי הודעה בודדת: טוקן שפג מייצר התראה
 * אחת ולא אחת לכל תור שהיה אמור לצאת.
 */
export function alertScopeForMetaError(
  code: number | undefined,
  httpStatus: number,
): string | null {
  if (code !== undefined && RECIPIENT_LEVEL_ERROR_CODES.has(code)) return null;
  // 190 / 102 — הטוקן פג, בוטל או נותק. במודל המנוהל כל בעלות העסק שולחות
  // דרך אותו טוקן, ולכן זו השבתה מלאה של ההודעות במוצר.
  if (code === 190 || code === 102) return "whatsapp.send.token";
  if (code === 10 || code === 200 || code === 299) return "whatsapp.send.permission";
  // מכסת הנמענים/הקצב של המספר. במודל המנוהל המכסה משותפת לכל העסקים.
  if (code === 4 || code === 80007 || code === 130429 || code === 131048 || code === 131056)
    return "whatsapp.send.limit";
  if (code === 131031 || code === 131042 || code === 368) return "whatsapp.send.account";
  // תבנית חסרה/לא מאושרת/עם מספר משתנים שגוי — שוברת סוג הודעה שלם לכולן.
  if (code === 131008 || code === 131009) return "whatsapp.send.template";
  if (code !== undefined && code >= 132000 && code <= 132999) return "whatsapp.send.template";
  if (httpStatus >= 500) return "whatsapp.send.meta_unavailable";
  return "whatsapp.send.other";
}

/** משפט הפעולה שיופיע במייל ההתראה — מה זה אומר ומה עושים עכשיו. */
const ALERT_HINTS: Record<string, string> = {
  "whatsapp.send.token":
    "הטוקן של Meta אינו תקף — אף הודעת WhatsApp אינה יוצאת לאף בעלת עסק. יש לייצר טוקן System User חדש ולעדכן את META_WHATSAPP_ACCESS_TOKEN בפרודקשן.",
  "whatsapp.send.permission":
    "לטוקן חסרות הרשאות ל-WhatsApp. יש לוודא ב-Meta Business Settings שלמשתמש המערכת יש whatsapp_business_messaging ו-whatsapp_business_management על חשבון ה-WhatsApp.",
  "whatsapp.send.limit":
    "המספר הגיע למכסת השליחה של Meta. המכסה משותפת לכל העסקים במוצר — יש לבדוק את ה-tier של המספר ב-WhatsApp Manager.",
  "whatsapp.send.account":
    "חשבון ה-WhatsApp או המספר הוגבלו על ידי Meta. יש להיכנס ל-WhatsApp Manager ולבדוק את סטטוס החשבון ואת דירוג האיכות.",
  "whatsapp.send.template":
    "התבנית נדחתה על ידי Meta — סוג ההודעה הזה שבור לכל בעלות העסק. יש לבדוק את סטטוס התבנית ב-WhatsApp Manager.",
  "whatsapp.send.meta_unavailable": "Meta החזירה שגיאת שרת. בדרך כלל חולף מעצמו; אם נמשך — לבדוק את סטטוס Graph API.",
  "whatsapp.send.network": "לא הצלחנו להגיע ל-Meta מהשרת. אם חוזר — ייתכן שהשליחות תקועות.",
  "whatsapp.send.other": "שליחת WhatsApp נכשלה מסיבה שאינה מסווגת. פרטי השגיאה של Meta מצורפים.",
};

/**
 * מתריע על כשל שליחה. best-effort לחלוטין — captureError אינו זורק ואינו
 * ממתין, ולכן נתיב השליחה אינו משתנה: ההודעה תיכשל בדיוק כמו קודם, רק שעכשיו
 * מישהו יידע על כך. בלי זה כשל שליחה נכתב ללוג בלבד, ותקלה תשתקף רק כשבעלת
 * עסק תתלונן.
 */
function alertOnSendFailure(
  scope: string,
  reason: string,
  context: Record<string, string | number | undefined>,
): void {
  captureError(scope, new Error(`${ALERT_HINTS[scope] ?? ALERT_HINTS["whatsapp.send.other"]} — ${reason}`), context);
}

/** Converts Record<"1"|"2"|..., string> → positional body component parameters for Meta. */
function buildBodyComponents(
  variables: Record<string, string>,
): Array<{ type: "text"; text: string }> {
  return Object.keys(variables)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => ({ type: "text" as const, text: variables[key] }));
}

/**
 * Opt-in verbose diagnostics. OFF by default so production never dumps full
 * request payloads or full Meta responses (which are noisy and can echo message
 * content). Set WHATSAPP_DEBUG_PAYLOADS=true only for a short debugging window.
 * Even when on, the recipient phone is always masked and the access token — which
 * lives only in the Authorization header, never in the logged body — is never logged.
 */
const debugPayloadsEnabled = () => process.env.WHATSAPP_DEBUG_PAYLOADS === "true";

export function createMetaCloudApiProvider(
  config: MetaProviderConfig,
): WhatsAppProvider {
  return {
    name: "meta_cloud_api",

    async send(params: SendMessageParams): Promise<SendMessageResult> {
      const { toPhone, templateId, templateLanguage, templateVariables, automationRunId, clientId, businessId } =
        params;

      if (!templateId) {
        return {
          success: false,
          providerMessageId: null,
          failureReason: "שם תבנית WhatsApp מאושרת חסר",
        };
      }

      // Meta requires E.164 without the leading '+'
      const recipientPhone = toPhone.startsWith("+") ? toPhone.slice(1) : toPhone;

      const bodyParams = templateVariables ? buildBodyComponents(templateVariables) : [];

      // שער אחרון לפני Meta: כשהתבנית היא אחת מתבניות Allura אנחנו יודעים כמה
      // משתנים היא מחייבת. אי-התאמה מוחזרת בעברית עם המספרים, במקום להישלח
      // ולחזור כ-131008 גנרי שאינו מזהה תבנית ואינו אומר כמה חסרו. לתבניות
      // שאיננו מגדירים (הוגדרו על ידי העסק) הבדיקה מדלגת — שם הספירה לא ידועה.
      const expectedVars = expectedTemplateVariableCount(templateId);
      if (expectedVars !== undefined && bodyParams.length !== expectedVars) {
        console.error(
          `[WhatsApp meta_cloud_api] BLOCKED before send — template variable mismatch. template=${templateId} expected=${expectedVars} got=${bodyParams.length} businessId=${businessId} clientId=${clientId} runId=${automationRunId}`,
        );
        // אי-התאמה כזו אינה תלוית-לקוחה: היא תחזור על כל שליחה של אותה תבנית.
        alertOnSendFailure(
          "whatsapp.send.template",
          `התבנית ${templateId} מחייבת ${expectedVars} משתנים אך נשלחו ${bodyParams.length}`,
          { businessId, template: templateId },
        );
        return {
          success: false,
          providerMessageId: null,
          failureReason: `תקלה בהגדרת ההודעה: התבנית מחייבת ${expectedVars} משתנים אך נשלחו ${bodyParams.length}`,
        };
      }

      const payload = {
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "template",
        template: {
          name: templateId,
          language: { code: templateLanguage ?? "he" },
          ...(bodyParams.length > 0 && {
            components: [
              {
                type: "body",
                parameters: bodyParams,
              },
            ],
          }),
        },
      };

      const url = `${META_GRAPH_BASE}/${config.apiVersion}/${config.phoneNumberId}/messages`;
      const maskedTo = maskPhone(recipientPhone);

      // Sanitized structured send log — masked recipient, resolved Phone Number ID,
      // template + language. This is the production diagnostic; it never carries a
      // credential, full phone or message body.
      console.log(
        `[WhatsApp meta_cloud_api] sending — businessId=${businessId} clientId=${clientId} runId=${automationRunId} to=${maskedTo} phoneNumberId=${config.phoneNumberId} template=${templateId} lang=${templateLanguage ?? "he"}`,
      );
      // Full payload dump only behind an explicit opt-in debug flag (recipient masked).
      if (debugPayloadsEnabled()) {
        console.log(
          `[WhatsApp meta_cloud_api] REQUEST PAYLOAD:\n${JSON.stringify({ ...payload, to: maskedTo }, null, 2)}`,
        );
      }

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (networkErr) {
        const reason =
          networkErr instanceof Error ? networkErr.message : "שגיאת רשת בשליחת הודעת WhatsApp";
        console.error(`[WhatsApp meta_cloud_api] network error — ${reason}`);
        alertOnSendFailure("whatsapp.send.network", reason, {
          businessId,
          template: templateId,
          phoneNumberId: config.phoneNumberId,
        });
        return {
          success: false,
          providerMessageId: null,
          failureReason: reason,
          phoneNumberIdUsed: config.phoneNumberId,
        };
      }

      let body: MetaMessageResponse & MetaErrorResponse;
      try {
        body = (await response.json()) as MetaMessageResponse & MetaErrorResponse;
      } catch {
        const reason = `Meta API החזיר תשובה לא תקינה (HTTP ${response.status})`;
        alertOnSendFailure(
          response.status >= 500 ? "whatsapp.send.meta_unavailable" : "whatsapp.send.other",
          reason,
          { businessId, template: templateId, phoneNumberId: config.phoneNumberId, httpStatus: response.status },
        );
        return {
          success: false,
          providerMessageId: null,
          failureReason: reason,
          phoneNumberIdUsed: config.phoneNumberId,
        };
      }

      // Full Meta response body only behind the explicit debug flag.
      if (debugPayloadsEnabled()) {
        console.log(
          `[WhatsApp meta_cloud_api] RESPONSE (HTTP ${response.status}):\n${JSON.stringify(body, null, 2)}`,
        );
      }

      if (!response.ok || body.error) {
        const reason = buildMetaErrorReason(body.error, response.status);
        const metaError = buildMetaErrorDetails(body.error);
        // Sanitized error log — Meta's own diagnostic fields (code/type/subcode/
        // fbtrace/message), masked recipient, resolved Phone Number ID. No credential.
        console.error(
          `[WhatsApp meta_cloud_api] API error — businessId=${businessId} to=${maskedTo} phoneNumberId=${config.phoneNumberId} template=${templateId} httpStatus=${response.status} code=${body.error?.code} type=${body.error?.type} subcode=${body.error?.error_subcode} fbtrace=${body.error?.fbtrace_id} message=${body.error?.message}`,
        );

        const alertScope = alertScopeForMetaError(body.error?.code, response.status);
        if (alertScope) {
          alertOnSendFailure(alertScope, reason, {
            businessId,
            template: templateId,
            phoneNumberId: config.phoneNumberId,
            to: maskedTo,
            httpStatus: response.status,
            metaCode: body.error?.code,
            metaSubcode: body.error?.error_subcode,
            fbtrace: body.error?.fbtrace_id,
          });
        }

        return {
          success: false,
          providerMessageId: null,
          failureReason: reason,
          metaError,
          phoneNumberIdUsed: config.phoneNumberId,
        };
      }

      const providerMessageId = body.messages?.[0]?.id ?? null;
      console.log(
        `[WhatsApp meta_cloud_api] sent — businessId=${businessId} clientId=${clientId} to=${maskedTo} phoneNumberId=${config.phoneNumberId} msgId=${providerMessageId}`,
      );

      return { success: true, providerMessageId, phoneNumberIdUsed: config.phoneNumberId };
    },
  };
}
