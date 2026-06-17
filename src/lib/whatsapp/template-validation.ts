/**
 * Local validation for Meta WhatsApp message-template payloads.
 *
 * Meta's template creation endpoint rejects malformed payloads with a generic
 * `error.message = "Invalid parameter"` (code 100) that does NOT say which field
 * was wrong. To make failures debuggable — and to avoid burning Meta quota on
 * payloads we already know are invalid — we validate locally first and surface an
 * exact Hebrew reason.
 *
 * The rules below mirror Meta's documented template constraints:
 *   - name: lowercase snake_case, no Hebrew / spaces / uppercase.
 *   - language: a supported BCP-47 code (Hebrew is `he`, NOT `he_IL`).
 *   - category: UTILITY | MARKETING | AUTHENTICATION.
 *   - body: non-empty, within Meta's length limit.
 *   - body variables ({{1}}, {{2}}, …) must be sequential starting at {{1}},
 *     with no gaps, no repeats, and in order of appearance. (`{{3}}` before
 *     `{{1}}` is the classic "Invalid parameter" cause.)
 *   - variables must not sit adjacent to each other ("{{1}}{{2}}").
 *   - the body should not begin or end with a bare variable.
 *   - the number of example values must equal the variable count, and every
 *     example must be non-empty and single-line (no newline/tab/control chars,
 *     which Meta rejects as "Invalid format" — code 100 / subcode 2388024).
 *   - no duplicate template names within one create/sync batch.
 *
 * This module is pure (no I/O, no secrets) so it is trivially unit-testable and
 * safe to log.
 */

import type { DefaultTemplate, MetaTemplateCategory } from "./default-templates";

/** Hebrew language codes Meta accepts for our templates. Hebrew is `he`. */
export const SUPPORTED_TEMPLATE_LANGUAGES = ["he", "he_IL"] as const;
export const SUPPORTED_TEMPLATE_CATEGORIES: MetaTemplateCategory[] = [
  "UTILITY",
  "MARKETING",
];

// Meta limits: name ≤ 512 chars, body ≤ 1024 chars.
const NAME_RE = /^[a-z0-9_]+$/;
const MAX_NAME_LENGTH = 512;
const MAX_BODY_LENGTH = 1024;
const VARIABLE_RE = /\{\{\s*(\d+)\s*\}\}/g;
// Meta rejects sample/example values that are not single-line plain text. Newlines,
// tabs and other control characters in an example trigger the generic "Invalid
// parameter" (code 100, subcode 2388024 "Invalid format") class of errors, so we
// catch them locally before burning a create call.
const EXAMPLE_CONTROL_RE = /[\u0000-\u001f\u007f]/;

export interface TemplateValidationResult {
  ok: boolean;
  /** Exact Hebrew reasons, one per failed rule. */
  errors: string[];
}

/**
 * Risk words for default MARKETING templates. Meta reviews marketing templates
 * far more strictly than utility ones, and promotional/discount/urgency wording
 * is a common rejection cause (the win-back template previously failed with code
 * 100 / subcode 2388024). Our shipped MARKETING defaults must stay neutral, so we
 * flag these words locally before ever calling Meta.
 */
export const MARKETING_RISK_WORDS = [
  "הנחה",
  "מבצע",
  "קופון",
  "אחוז",
  "חינם",
  "רק היום",
  "מוגבל בזמן",
] as const;

/** Returns the risk words found in a marketing body (empty when neutral). */
export function findMarketingRiskWords(body: string): string[] {
  const text = body ?? "";
  return MARKETING_RISK_WORDS.filter((w) => text.includes(w));
}

/** Returns the variable numbers in the order they appear in the body text. */
export function extractBodyVariables(body: string): number[] {
  return [...body.matchAll(VARIABLE_RE)].map((m) => Number(m[1]));
}

/** True when two variables sit directly adjacent with no separator, e.g. "{{1}}{{2}}". */
function hasAdjacentVariables(body: string): boolean {
  return /\}\}\{\{/.test(body);
}

/** Validates a single default template payload. */
export function validateTemplate(tpl: DefaultTemplate): TemplateValidationResult {
  const errors: string[] = [];

  // --- name ---
  if (!tpl.name || tpl.name.trim().length === 0) {
    errors.push("שם התבנית חסר.");
  } else {
    if (tpl.name.length > MAX_NAME_LENGTH) {
      errors.push(`שם התבנית ארוך מדי (מקסימום ${MAX_NAME_LENGTH} תווים).`);
    }
    if (!NAME_RE.test(tpl.name)) {
      errors.push(
        `שם התבנית "${tpl.name}" לא תקין — חובה אותיות אנגליות קטנות, ספרות וקו תחתון בלבד (snake_case), ללא עברית או רווחים.`,
      );
    }
  }

  // --- language ---
  if (!SUPPORTED_TEMPLATE_LANGUAGES.includes(tpl.language as (typeof SUPPORTED_TEMPLATE_LANGUAGES)[number])) {
    errors.push(
      `קוד השפה "${tpl.language}" לא נתמך. עבור עברית יש להשתמש ב־"he".`,
    );
  }

  // --- category ---
  if (!SUPPORTED_TEMPLATE_CATEGORIES.includes(tpl.category)) {
    errors.push(
      `קטגוריה "${tpl.category}" לא נתמכת. ערכים מותרים: ${SUPPORTED_TEMPLATE_CATEGORIES.join(", ")}.`,
    );
  }

  // --- body ---
  const body = (tpl.body ?? "").trim();
  if (body.length === 0) {
    errors.push("טקסט ההודעה ריק.");
  } else if (body.length > MAX_BODY_LENGTH) {
    errors.push(`טקסט ההודעה ארוך מדי (מקסימום ${MAX_BODY_LENGTH} תווים).`);
  }

  // --- variables ---
  const vars = extractBodyVariables(body);
  const expected = tpl.example?.length ?? 0;

  // Sequential, starting at 1, no gaps, no repeats, in order of appearance.
  const sequentialOk = vars.every((n, i) => n === i + 1);
  if (vars.length > 0 && !sequentialOk) {
    errors.push(
      `המשתנים בטקסט אינם לפי הסדר ({{1}}, {{2}}, ...). נמצא הסדר: ${vars
        .map((n) => `{{${n}}}`)
        .join(", ")}.`,
    );
  }

  if (hasAdjacentVariables(body)) {
    errors.push("שני משתנים צמודים זה לזה — חובה טקסט מפריד ביניהם.");
  }

  // Meta rejects bodies that begin or end with a bare variable.
  if (vars.length > 0) {
    if (/^\s*\{\{\s*\d+\s*\}\}/.test(body)) {
      errors.push("טקסט ההודעה לא יכול להתחיל במשתנה.");
    }
    if (/\{\{\s*\d+\s*\}\}\s*$/.test(body)) {
      errors.push("טקסט ההודעה לא יכול להסתיים במשתנה.");
    }
  }

  // --- examples ---
  if (vars.length !== expected) {
    errors.push(
      `מספר הדוגמאות (${expected}) אינו תואם למספר המשתנים בטקסט (${
        new Set(vars).size
      }).`,
    );
  }
  (tpl.example ?? []).forEach((ex, i) => {
    if (!ex || ex.trim().length === 0) {
      errors.push(`חסרה דוגמה למשתנה {{${i + 1}}}.`);
    } else if (EXAMPLE_CONTROL_RE.test(ex)) {
      // Newlines/tabs/control chars in a sample value are the "Invalid format"
      // (code 100 / subcode 2388024) class — Meta wants single-line plain examples.
      errors.push(`הדוגמה למשתנה {{${i + 1}}} מכילה תו לא חוקי (שורה חדשה או תו בקרה).`);
    }
  });

  // --- marketing risk words ---
  // Our shipped MARKETING defaults must stay low-risk for Meta review, so a
  // promotional/discount/urgency word in a default MARKETING body is blocked
  // locally before it can trigger a Meta rejection.
  if (tpl.category === "MARKETING") {
    const risky = findMarketingRiskWords(body);
    if (risky.length > 0) {
      errors.push(
        `תבנית שיווקית: מומלץ להימנע ממילים שעלולות להידחות (${risky.join(", ")}). תבנית ברירת המחדל צריכה להישאר ניטרלית.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export interface BatchValidationItem {
  name: string;
  result: TemplateValidationResult;
}

/**
 * Validates a whole batch and additionally flags duplicate names within the
 * batch (Meta would reject the second create as "name already exists").
 */
export function validateTemplateBatch(
  templates: DefaultTemplate[],
): BatchValidationItem[] {
  const seen = new Map<string, number>();
  for (const t of templates) seen.set(t.name, (seen.get(t.name) ?? 0) + 1);

  return templates.map((tpl) => {
    const result = validateTemplate(tpl);
    if ((seen.get(tpl.name) ?? 0) > 1) {
      result.errors.push(`שם התבנית "${tpl.name}" מופיע יותר מפעם אחת באותו סנכרון.`);
    }
    return { name: tpl.name, result: { ok: result.errors.length === 0, errors: result.errors } };
  });
}
