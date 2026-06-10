/**
 * Standalone test script — calls runWinBackForBusiness directly,
 * the same logic POST /api/admin/automation/run-now delegates to.
 * Run from project root: npx tsx --env-file=.env scripts/run-winback-test.ts
 */

import { runWinBackForBusiness } from "@/server/win-back-automation/runner";
import { prisma } from "@/server/db/prisma";

const BIZ_ID = "cmq6qz1ls0003pf3x1jslk77v";
const CLIENT_ID = "test_client_guytest_001";

async function main() {
  const business = await prisma.business.findUnique({
    where: { id: BIZ_ID },
    select: { id: true, name: true, slug: true },
  });

  if (!business) {
    console.error("Business not found:", BIZ_ID);
    process.exit(1);
  }

  console.log("\n=== ENV CHECK ===");
  console.log("ENABLE_REAL_WHATSAPP_SEND:", process.env.ENABLE_REAL_WHATSAPP_SEND);
  console.log("WHATSAPP_PROVIDER:", process.env.WHATSAPP_PROVIDER);
  console.log("WHATSAPP_TEST_MODE:", process.env.WHATSAPP_TEST_MODE);
  console.log("WHATSAPP_TEST_PHONE:", process.env.WHATSAPP_TEST_PHONE);
  console.log("META credentials present:", !!(process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID));

  console.log("\n=== CLIENT ===");
  const client = await prisma.client.findUnique({
    where: { id: CLIENT_ID },
    select: {
      id: true,
      fullName: true,
      phone: true,
      normalizedPhone: true,
      whatsappOptIn: true,
      marketingOptIn: true,
      unsubscribedAt: true,
    },
  });
  console.log(JSON.stringify(client, null, 2));

  const bookings = await prisma.booking.findMany({
    where: { clientId: CLIENT_ID },
    select: { id: true, status: true, startTime: true, source: true },
  });
  console.log("\n=== BOOKINGS ===");
  console.log(JSON.stringify(bookings, null, 2));

  const completedBookings = bookings.filter((b) => b.status === "completed");
  const daysSince =
    completedBookings.length > 0
      ? Math.floor(
          (Date.now() - completedBookings[0].startTime.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;
  console.log("Days since last completed booking:", daysSince);

  const setting = await prisma.automationSetting.findUnique({
    where: { businessId_type: { businessId: BIZ_ID, type: "win_back" } },
  });
  console.log("\n=== AUTOMATION SETTING ===");
  console.log(JSON.stringify(setting, null, 2));

  console.log("\n=== RUNNING WIN-BACK AUTOMATION ===");
  const result = await runWinBackForBusiness(business);
  console.log("\n=== RUN RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  if (result.runId) {
    const run = await prisma.automationRun.findUnique({ where: { id: result.runId } });
    console.log("\n=== AutomationRun record ===");
    console.log(JSON.stringify(run, null, 2));

    const messages = await prisma.automationMessage.findMany({
      where: { runId: result.runId },
      select: {
        id: true, clientId: true, phone: true, status: true,
        failureReason: true, providerMessageId: true, sentAt: true,
        templateId: true, createdAt: true,
      },
    });
    console.log("\n=== AutomationMessage records ===");
    console.log(JSON.stringify(messages, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
