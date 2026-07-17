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
        return {
          success: false,
          providerMessageId: null,
          failureReason: `Meta API החזיר תשובה לא תקינה (HTTP ${response.status})`,
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
