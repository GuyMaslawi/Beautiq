/**
 * One-off maintenance script (admin-only, run by hand):
 * re-stamp stale env-fallback WhatsAppConnection rows after a managed-number rotation.
 *
 * WHY: adminConnectBusinessFromEnv snapshots META_WHATSAPP_PHONE_NUMBER_ID into the
 * WhatsAppConnection row. When Allura's managed number rotates (e.g. Meta test number
 * "+1 555-900-1549" / 1170382949488802 → production "+972 50-603-4514" / 1245832988604563),
 * those snapshots go stale. The resolver now prefers env for Mode A connections, so
 * SENDING is already correct — this script only refreshes the stored snapshot +
 * display number so admin panels and readiness checks show the right number too.
 *
 * SAFETY:
 *  - Dry-run by default. Pass --apply to write.
 *  - Verifies the env phone-number-id against the Meta Graph API before writing.
 *  - Only touches rows with useEnvFallback=true (Mode A). Mode B rows (a business's
 *    own Embedded Signup number) are never modified.
 *  - Never logs the access token. Sends NO WhatsApp messages.
 *
 * Run from project root:
 *   npx tsx --env-file=.env scripts/fix-whatsapp-phone-number.ts          # dry-run
 *   npx tsx --env-file=.env scripts/fix-whatsapp-phone-number.ts --apply  # write
 */

import { PrismaClient } from "@prisma/client";

const META_GRAPH_BASE = "https://graph.facebook.com";

async function main() {
  const apply = process.argv.includes("--apply");
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const envPhoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";

  console.log("\n=== Fix stale WhatsAppConnection phone-number snapshots ===");
  console.log("Mode:", apply ? "APPLY (will write)" : "dry-run (no writes)");
  console.log("Env Phone Number ID:", envPhoneNumberId ?? "MISSING");

  if (!accessToken || !envPhoneNumberId) {
    console.error("META_WHATSAPP_ACCESS_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID missing. Aborting.");
    process.exit(1);
  }

  // Verify the env id is live and readable before stamping it anywhere.
  const res = await fetch(
    `${META_GRAPH_BASE}/${apiVersion}/${envPhoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    console.error(
      `Meta verification of ${envPhoneNumberId} FAILED (HTTP ${res.status}):`,
      (body.error?.message ?? "unknown").replace(/EAA\S+/g, "[token]"),
    );
    process.exit(1);
  }
  const meta = (await res.json()) as { display_phone_number?: string; verified_name?: string };
  console.log("Meta says:", meta.display_phone_number, "·", meta.verified_name);

  const prisma = new PrismaClient();
  const stale = await prisma.whatsAppConnection.findMany({
    where: { useEnvFallback: true, NOT: { phoneNumberId: envPhoneNumberId } },
    select: {
      id: true,
      businessId: true,
      status: true,
      phoneNumberId: true,
      displayPhoneNumber: true,
      business: { select: { name: true, slug: true } },
    },
  });

  if (stale.length === 0) {
    console.log("\n✅ No stale env-fallback connections found. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nFound ${stale.length} stale env-fallback connection(s):`);
  for (const c of stale) {
    console.log(
      `  - business="${c.business.name}" (${c.business.slug}) status=${c.status}` +
        ` phoneNumberId=${c.phoneNumberId ?? "(null)"} display=${c.displayPhoneNumber ?? "(null)"}` +
        ` → ${envPhoneNumberId} / ${meta.display_phone_number}`,
    );
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to update these rows.");
    await prisma.$disconnect();
    return;
  }

  const now = new Date();
  const result = await prisma.whatsAppConnection.updateMany({
    where: { id: { in: stale.map((c) => c.id) } },
    data: {
      phoneNumberId: envPhoneNumberId,
      displayPhoneNumber: meta.display_phone_number ?? null,
      lastVerifiedAt: now,
      lastError: null,
    },
  });
  console.log(`\n✅ Updated ${result.count} connection(s) to Phone Number ID ${envPhoneNumberId}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
