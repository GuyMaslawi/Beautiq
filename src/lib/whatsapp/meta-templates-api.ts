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

/**
 * Token-free, owner/admin-safe subset of a Meta template error. We surface these
 * fields in admin diagnostics so an "Invalid parameter" failure is debuggable.
 * NEVER carries the access token, Authorization header, or raw credentials.
 */
export interface SafeMetaTemplateError {
  message: string;
  type?: string;
  code?: number;
  errorSubcode?: number;
  /** Safe extra detail from error.error_data (e.g. the offending parameter). */
  errorData?: string;
  fbtraceId?: string;
}

interface RawMetaError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_data?: { details?: string } | string;
  fbtrace_id?: string;
}

/** Extracts the safe, token-scrubbed subset of a Meta error object. */
export function toSafeMetaError(raw: RawMetaError | undefined, httpStatus: number): SafeMetaTemplateError {
  const detailsRaw =
    typeof raw?.error_data === "string" ? raw.error_data : raw?.error_data?.details;
  return {
    message: scrubToken(raw?.message ?? `HTTP ${httpStatus}`),
    type: raw?.type,
    code: raw?.code,
    errorSubcode: raw?.error_subcode,
    errorData: detailsRaw ? scrubToken(String(detailsRaw)) : undefined,
    fbtraceId: raw?.fbtrace_id,
  };
}

/** Builds a single-line human reason from the safe error fields (for the UI). */
export function formatSafeMetaError(e: SafeMetaTemplateError): string {
  const parts: string[] = [];
  if (typeof e.code === "number") parts.push(`code ${e.code}`);
  if (typeof e.errorSubcode === "number") parts.push(`subcode ${e.errorSubcode}`);
  if (e.type) parts.push(`type ${e.type}`);
  if (e.errorData) parts.push(e.errorData);
  if (e.fbtraceId) parts.push(`trace ${e.fbtraceId}`);
  return parts.length > 0 ? `${e.message} [${parts.join(" · ")}]` : e.message;
}

export interface CreateTemplateResult {
  ok: boolean;
  /** Meta template id, if created. */
  id?: string;
  status?: TemplateStatus;
  /** Single-line human reason (token-scrubbed) — kept for backwards-compat. */
  error?: string;
  /** Structured, token-free Meta error fields for admin diagnostics. */
  metaError?: SafeMetaTemplateError;
  /** True when the template already existed (treated as success). */
  alreadyExists?: boolean;
}

/**
 * The sanitized outgoing template payload — exactly what we POST to Meta, minus
 * any transport credentials (there are none in the body). Used for dev/admin
 * diagnostics so we can see precisely what was sent.
 */
export interface SanitizedTemplatePayload {
  name: string;
  language: string;
  category: string;
  componentTypes: string[];
  bodyText: string;
  variableExamples: string[];
}

export function buildSanitizedTemplatePayload(tpl: DefaultTemplate): SanitizedTemplatePayload {
  return {
    name: tpl.name,
    language: tpl.language,
    category: tpl.category,
    componentTypes: ["BODY"],
    bodyText: tpl.body,
    variableExamples: tpl.example,
  };
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
    const data = (await res.json()) as { id?: string; status?: string; error?: RawMetaError };

    if (res.ok && data.id) {
      return { ok: true, id: data.id, status: normalizeTemplateStatus(data.status) };
    }

    const msg = data.error?.message ?? `HTTP ${res.status}`;
    // Template name already exists in this WABA → not an error for our purposes.
    if (/already exists|name.*taken|duplicate/i.test(msg)) {
      return { ok: true, alreadyExists: true, status: "unknown" };
    }
    const metaError = toSafeMetaError(data.error, res.status);
    return { ok: false, error: formatSafeMetaError(metaError), metaError };
  } catch (err) {
    const message = err instanceof Error ? scrubToken(err.message) : "שגיאת רשת";
    return { ok: false, error: message, metaError: { message } };
  }
}

export interface ListedTemplate {
  name: string;
  language: string;
  status: TemplateStatus;
  /** The exact status string Meta returned (e.g. "APPROVED"), before normalization. */
  rawStatus?: string;
  category?: string;
}

export interface ListTemplatesResult {
  ok: boolean;
  templates?: ListedTemplate[];
  error?: string;
  /** HTTP status from the Graph API call — surfaced for admin diagnostics. */
  httpStatus?: number;
  /** Meta error code (e.g. 190 invalid token, 200 missing permission), when present. */
  errorCode?: number;
  /** Meta error type (e.g. OAuthException), when present. */
  errorType?: string;
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
      error?: { message?: string; code?: number; type?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: scrubToken(data.error?.message ?? `HTTP ${res.status}`),
        httpStatus: res.status,
        errorCode: data.error?.code,
        errorType: data.error?.type,
      };
    }
    const templates = (data.data ?? []).map((t) => ({
      name: t.name,
      language: t.language,
      status: normalizeTemplateStatus(t.status),
      rawStatus: t.status,
      category: t.category,
    }));
    return { ok: true, templates, httpStatus: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת" };
  }
}
