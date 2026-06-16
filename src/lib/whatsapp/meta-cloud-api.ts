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

import type { WhatsAppProvider, SendMessageParams, SendMessageResult } from "./provider";

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

/** Converts Record<"1"|"2"|..., string> → positional body component parameters for Meta. */
function buildBodyComponents(
  variables: Record<string, string>,
): Array<{ type: "text"; text: string }> {
  return Object.keys(variables)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => ({ type: "text" as const, text: variables[key] }));
}

/**
 * Fetches a template's definition from Meta so we can compare it against
 * what we're building in the payload. Call this when debugging 131008 errors.
 */
async function fetchTemplateDefinition(
  config: MetaProviderConfig,
  templateName: string,
  wabaId: string,
): Promise<unknown> {
  const url = `${META_GRAPH_BASE}/${config.apiVersion}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,language,components,status`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    return await res.json();
  } catch (e) {
    return { fetchError: String(e) };
  }
}

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

      console.log(
        `[WhatsApp meta_cloud_api] sending — businessId=${businessId} clientId=${clientId} runId=${automationRunId} to=${recipientPhone} template=${templateId}`,
      );
      // Full payload (access token is only in the Authorization header, not here)
      console.log(
        `[WhatsApp meta_cloud_api] REQUEST PAYLOAD:\n${JSON.stringify(payload, null, 2)}`,
      );

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
        return { success: false, providerMessageId: null, failureReason: reason };
      }

      let body: MetaMessageResponse & MetaErrorResponse;
      try {
        body = (await response.json()) as MetaMessageResponse & MetaErrorResponse;
      } catch {
        return {
          success: false,
          providerMessageId: null,
          failureReason: `Meta API החזיר תשובה לא תקינה (HTTP ${response.status})`,
        };
      }

      // Always log the full response for diagnostics
      console.log(
        `[WhatsApp meta_cloud_api] RESPONSE (HTTP ${response.status}):\n${JSON.stringify(body, null, 2)}`,
      );

      if (!response.ok || body.error) {
        const reason = buildMetaErrorReason(body.error, response.status);
        console.error(
          `[WhatsApp meta_cloud_api] API error — businessId=${businessId} code=${body.error?.code} type=${body.error?.type} subcode=${body.error?.error_subcode} fbtrace=${body.error?.fbtrace_id} message=${body.error?.message}`,
        );

        // On "Required parameter is missing" (131008) fetch the template definition
        // from Meta so we can compare its expected components against what we sent.
        if (body.error?.code === 131008) {
          const wabaId = process.env.META_WHATSAPP_WABA_ID ?? "";
          if (wabaId) {
            const templateDef = await fetchTemplateDefinition(config, templateId, wabaId);
            console.error(
              `[WhatsApp meta_cloud_api] TEMPLATE DEFINITION from Meta (for mismatch debug):\n${JSON.stringify(templateDef, null, 2)}`,
            );
          } else {
            console.error(
              `[WhatsApp meta_cloud_api] META_WHATSAPP_WABA_ID not set — cannot fetch template definition for debug`,
            );
          }
        }

        return { success: false, providerMessageId: null, failureReason: reason };
      }

      const providerMessageId = body.messages?.[0]?.id ?? null;
      console.log(
        `[WhatsApp meta_cloud_api] sent — businessId=${businessId} clientId=${clientId} msgId=${providerMessageId}`,
      );

      return { success: true, providerMessageId };
    },
  };
}
