export interface MessageVars {
  clientName?: string;
  businessName?: string;
  serviceName?: string;
  bookingDate?: string;
  bookingTime?: string;
  price?: string;
}

const FALLBACK = "לא צוין";

/** Replace all {variable} placeholders in a template body with real values. */
export function renderTemplate(body: string, vars: MessageVars): string {
  return body
    .replace(/\{clientName\}/g, vars.clientName ?? FALLBACK)
    .replace(/\{businessName\}/g, vars.businessName ?? FALLBACK)
    .replace(/\{serviceName\}/g, vars.serviceName ?? FALLBACK)
    .replace(/\{bookingDate\}/g, vars.bookingDate ?? FALLBACK)
    .replace(/\{bookingTime\}/g, vars.bookingTime ?? FALLBACK)
    .replace(/\{price\}/g, vars.price ?? FALLBACK);
}
