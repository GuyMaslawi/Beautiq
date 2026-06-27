/**
 * One-time WhatsApp phone-number registration script (admin-only, run by hand).
 *
 * Activates a phone number for the Cloud API by calling Meta's Register endpoint:
 *   POST https://graph.facebook.com/{version}/{phone-number-id}/register
 *   body: { messaging_product: "whatsapp", pin: <6-digit two-step verification PIN> }
 *
 * This is what the Meta dashboard "Register" button does behind the scenes. Use it
 * when the dashboard returns a generic "Registration failed. Please try again."
 *
 * SAFETY:
 *  - Never logs the access token or the PIN.
 *  - Sends NO WhatsApp messages.
 *  - Refuses to run against the OLD phone-number-id to avoid mixing numbers.
 *
 * Run from project root:
 *   npx tsx --env-file=.env scripts/register-whatsapp-number.ts
 */

import { buildMetaErrorReason } from "@/lib/whatsapp/meta-cloud-api";

const META_GRAPH_BASE = "https://graph.facebook.com";

// The phone-number-id we INTEND to register (current "+1 555-900-1549" number).
const EXPECTED_PHONE_NUMBER_ID = "1170382949488802";
// The previous number's id — guard so we never accidentally register the wrong one.
const OLD_PHONE_NUMBER_ID = "1162151566985002";

interface MetaRegisterResponse {
  success?: boolean;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: { details?: string };
  };
}

/** Masks a credential for safe logging (length only, never the value). */
function presence(value: string | undefined): string {
  return value ? `present (length ${value.length})` : "MISSING";
}

async function main() {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const pin = process.env.META_WHATSAPP_REGISTRATION_PIN;
  const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";
  const phoneNumberId =
    process.env.META_WHATSAPP_REGISTER_PHONE_NUMBER_ID ?? EXPECTED_PHONE_NUMBER_ID;

  console.log("\n=== WhatsApp number registration (one-time) ===");
  console.log("Phone Number ID:", phoneNumberId);
  console.log("API version:", apiVersion);
  console.log("Access token:", presence(accessToken));
  console.log("Registration PIN:", pin ? "present (hidden)" : "MISSING");
  console.log("WHATSAPP_TEST_MODE:", process.env.WHATSAPP_TEST_MODE);

  // --- Pre-flight validation -------------------------------------------------
  if (phoneNumberId === OLD_PHONE_NUMBER_ID) {
    console.error(
      "\nRefusing to run: this is the OLD phone-number-id. Set the correct id and retry.",
    );
    process.exit(1);
  }
  if (!accessToken) {
    console.error("\nMETA_WHATSAPP_ACCESS_TOKEN is not set. Aborting.");
    process.exit(1);
  }
  if (!pin) {
    console.error("\nMETA_WHATSAPP_REGISTRATION_PIN is not set. Aborting.");
    process.exit(1);
  }
  if (!/^\d{6}$/.test(pin)) {
    console.error(
      "\nMETA_WHATSAPP_REGISTRATION_PIN must be exactly 6 digits. Aborting.",
    );
    process.exit(1);
  }

  const url = `${META_GRAPH_BASE}/${apiVersion}/${phoneNumberId}/register`;
  const payload = {
    messaging_product: "whatsapp",
    pin, // never logged
  };

  console.log("\n=== Calling Meta Register endpoint ===");
  console.log("POST", url);
  // Log the payload shape WITHOUT the PIN value.
  console.log("Body: { messaging_product: \"whatsapp\", pin: \"******\" }");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (networkErr) {
    const reason = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error("\nNetwork error calling Meta:", reason);
    process.exit(1);
  }

  let body: MetaRegisterResponse;
  try {
    body = (await response.json()) as MetaRegisterResponse;
  } catch {
    console.error(`\nMeta returned a non-JSON response (HTTP ${response.status}).`);
    process.exit(1);
  }

  console.log(`\n=== Meta response (HTTP ${response.status}) ===`);
  // Safe to print: contains no credentials (we never sent them in the body).
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok || body.error) {
    console.error("\n❌ Registration FAILED");
    console.error("Reason:", buildMetaErrorReason(body.error, response.status));
    process.exit(1);
  }

  console.log("\n✅ Registration SUCCEEDED.");
  console.log("\nNext steps:");
  console.log(`  1. Set in .env:  META_WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId}`);
  console.log("  2. Keep WHATSAPP_TEST_MODE=true for now.");
  console.log("  3. Re-run diagnostics (connection check + template sync) — no real customer sends.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
