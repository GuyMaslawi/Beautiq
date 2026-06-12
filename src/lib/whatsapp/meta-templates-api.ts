/**
 * Meta Message Templates API — create & list WhatsApp templates for a WABA.
 *
 * Used by the template setup flow after Embedded Signup:
 *   - createTemplate  → Option A ("יצירת תבניות WhatsApp")
 *   - listTemplates   → Option B sync ("סנכרון תבניות")
 *
 * SAFETY: the access token is only sent in the Authorization header and is
 * never logged. Errors are scrubbed of token-looking strings.
 */

import type { DefaultTemplate } from "./default-templates";
import { scrubToken } from "./meta-onboarding";

const META_GRAPH_BASE = "https://graph.facebook.com";

function apiVersion(): string {
  return process.env.META_WHATSAPP_API_VERSION ?? "v19.0";
}

/** Normalized Meta template status. */
export type TemplateStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "unknown";

export function normalizeTemplateStatus(raw: string | undefined): TemplateStatus {
  switch ((raw ?? "").toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "PENDING":
    case "IN_APPEAL":
    case "PENDING_DELETION":
      return "pending";
    case "REJECTED":
    case "DISABLED":
    case "PAUSED":
      return "rejected";
    default:
      return "unknown";
  }
}

export interface CreateTemplateResult {
  ok: boolean;
  /** Meta template id, if created. */
  id?: string;
  status?: TemplateStatus;
  error?: string;
  /** True when the template already existed (treated as success). */
  alreadyExists?: boolean;
}

/** Creates one template in the WABA. Idempotent on "already exists". */
export async function createTemplate(
  wabaId: string,
  accessToken: string,
  tpl: DefaultTemplate,
): Promise<CreateTemplateResult> {
  const url = `${META_GRAPH_BASE}/${apiVersion()}/${wabaId}/message_templates`;
  const payload = {
    name: tpl.name,
    language: tpl.language,
    category: tpl.category,
    components: [
      {
        type: "BODY",
        text: tpl.body,
        example: { body_text: [tpl.example] },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = (await res.json()) as {
      id?: string;
      status?: string;
      error?: { message?: string; code?: number; error_subcode?: number };
    };

    if (res.ok && data.id) {
      return { ok: true, id: data.id, status: normalizeTemplateStatus(data.status) };
    }

    const msg = data.error?.message ?? `HTTP ${res.status}`;
    // Template name already exists in this WABA → not an error for our purposes.
    if (/already exists|name.*taken|duplicate/i.test(msg)) {
      return { ok: true, alreadyExists: true, status: "unknown" };
    }
    return { ok: false, error: scrubToken(msg) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת" };
  }
}

export interface ListedTemplate {
  name: string;
  language: string;
  status: TemplateStatus;
  category?: string;
}

export interface ListTemplatesResult {
  ok: boolean;
  templates?: ListedTemplate[];
  error?: string;
}

/** Lists all message templates in a WABA (handles a single page; enough for our 4). */
export async function listTemplates(
  wabaId: string,
  accessToken: string,
): Promise<ListTemplatesResult> {
  const url =
    `${META_GRAPH_BASE}/${apiVersion()}/${wabaId}/message_templates` +
    `?fields=name,language,status,category&limit=200`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await res.json()) as {
      data?: Array<{ name: string; language: string; status: string; category?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: scrubToken(data.error?.message ?? `HTTP ${res.status}`) };
    }
    const templates = (data.data ?? []).map((t) => ({
      name: t.name,
      language: t.language,
      status: normalizeTemplateStatus(t.status),
      category: t.category,
    }));
    return { ok: true, templates };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת" };
  }
}
