/**
 * READ-ONLY database audit. Deletes nothing, writes nothing.
 *
 * Lists every user (+ their businesses) and row counts for all tables, so you
 * can confirm production holds only the accounts it should.
 *
 * Run against production:
 *   DATABASE_URL="<prod url>" DIRECT_URL="<prod url>" npx tsx scripts/audit-db.ts
 *
 * Temporary tool — safe to delete.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function safeCount(label: string, fn: () => Promise<number>): Promise<[string, number | string]> {
  try {
    return [label, await fn()];
  } catch {
    return [label, "ERR (table missing?)"];
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const u = new URL(url);
    console.log(`Connected target: host=${u.hostname} db=${u.pathname.slice(1)}`);
  } catch {
    console.log("Connected target: (could not parse DATABASE_URL)");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      plan: true,
      planExpiresAt: true,
      createdAt: true,
      lastSeenAt: true,
      memberships: {
        select: {
          role: true,
          business: { select: { id: true, name: true, slug: true, createdAt: true } },
        },
      },
    },
  });

  console.log(`\n===== USERS (${users.length}) =====`);
  for (const u of users) {
    console.log(
      `\n- ${u.email}${u.isAdmin ? "  [ADMIN]" : ""}\n` +
        `  name=${u.name ?? "-"}  plan=${u.plan ?? "none"}  expires=${u.planExpiresAt?.toISOString() ?? "-"}\n` +
        `  created=${u.createdAt.toISOString()}  lastSeen=${u.lastSeenAt?.toISOString() ?? "never"}\n` +
        `  id=${u.id}`
    );
    if (u.memberships.length === 0) {
      console.log("    business: (none)");
    } else {
      for (const m of u.memberships) {
        console.log(
          `    business: ${m.business.name} (/${m.business.slug}) role=${m.role} id=${m.business.id}`
        );
      }
    }
  }

  const orphans = await prisma.business.findMany({
    where: { members: { none: {} } },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
  console.log(`\n===== BUSINESSES WITH NO OWNER (${orphans.length}) =====`);
  for (const b of orphans) {
    console.log(`- ${b.name} (/${b.slug}) id=${b.id} created=${b.createdAt.toISOString()}`);
  }

  console.log("\n===== ROW COUNTS ('*' = non-empty) =====");
  const entries = await Promise.all([
    safeCount("User", () => prisma.user.count()),
    safeCount("Business", () => prisma.business.count()),
    safeCount("BusinessUser", () => prisma.businessUser.count()),
    safeCount("Service", () => prisma.service.count()),
    safeCount("Client", () => prisma.client.count()),
    safeCount("Booking", () => prisma.booking.count()),
    safeCount("AvailabilityRule", () => prisma.availabilityRule.count()),
    safeCount("AvailabilityException", () => prisma.availabilityException.count()),
    safeCount("CancellationPolicy", () => prisma.cancellationPolicy.count()),
    safeCount("MessageTemplate", () => prisma.messageTemplate.count()),
    safeCount("Reminder", () => prisma.reminder.count()),
    safeCount("WaitlistEntry", () => prisma.waitlistEntry.count()),
    safeCount("GalleryImage", () => prisma.galleryImage.count()),
    safeCount("ClientReview", () => prisma.clientReview.count()),
    safeCount("Recommendation", () => prisma.recommendation.count()),
    safeCount("Expense", () => prisma.expense.count()),
    safeCount("BusinessSubscription", () => prisma.businessSubscription.count()),
    safeCount("AccountSubscription", () => prisma.accountSubscription.count()),
    safeCount("SubscriptionCharge", () => prisma.subscriptionCharge.count()),
    safeCount("WhatsAppConnection", () => prisma.whatsAppConnection.count()),
    safeCount("AutomationSetting", () => prisma.automationSetting.count()),
    safeCount("AutomationRun", () => prisma.automationRun.count()),
    safeCount("AutomationMessage", () => prisma.automationMessage.count()),
    safeCount("WhatsAppCampaign", () => prisma.whatsAppCampaign.count()),
    safeCount("WhatsAppCampaignRecipient", () => prisma.whatsAppCampaignRecipient.count()),
    safeCount("LoyaltyProgram", () => prisma.loyaltyProgram.count()),
    safeCount("LoyaltyMessage", () => prisma.loyaltyMessage.count()),
    safeCount("LoyaltyRedemption", () => prisma.loyaltyRedemption.count()),
    safeCount("ActivityLog", () => prisma.activityLog.count()),
    safeCount("PasswordResetToken", () => prisma.passwordResetToken.count()),
    safeCount("RateLimitCounter", () => prisma.rateLimitCounter.count()),
    // Reference data — SHOULD be non-empty
    safeCount("BusinessCategory (ref)", () => prisma.businessCategory.count()),
    safeCount("SystemMessageTemplate (ref)", () => prisma.systemMessageTemplate.count()),
  ]);
  for (const [k, v] of entries) {
    console.log(`${v === 0 ? " " : "*"} ${k.padEnd(30)} ${v}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
