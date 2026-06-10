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

      if (!response.ok || body.error) {
        const reason =
          body.error?.message ??
          `Meta API שגיאה ${response.status}`;
        console.error(
          `[WhatsApp meta_cloud_api] API error — businessId=${businessId} code=${body.error?.code} type=${body.error?.type} message=${body.error?.message}`,
        );
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
