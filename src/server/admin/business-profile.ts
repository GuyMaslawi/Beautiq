/**
 * Admin "360° business dossier" read model.
 *
 * Assembles a full per-business profile for the platform admin: revenue and
 * forecast (reusing the tenant-scoped finance/forecast engines with the target
 * businessId), a lifetime booking breakdown, feature-adoption/usage intensity,
 * and a recent-activity timeline — all derived from data that already exists.
 *
 * Server-only. Admin-gated at the call site (requirePlatformAdmin).
 */

import { prisma } from "@/server/db/prisma";
import {
  getRevenueForecastData,
  type RevenueForecastData,
} from "@/server/revenue-forecast/queries";
import { getFinanceData, getDateRangeForPeriod } from "@/server/finance/queries";
import type {
  BookingStatus,
  ActivityCategory,
  ActivityActorType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UsageLevel = "none" | "low" | "medium" | "high";

export interface FeatureUsage {
  key: string;
  /** Hebrew feature label. */
  label: string;
  /** Raw count backing the usage judgement. */
  count: number;
  level: UsageLevel;
  /** Optional short Hebrew qualifier (e.g. "מועדון פעיל"). */
  hint?: string;
}

export interface RecentBookingRow {
  id: string;
  clientName: string;
  serviceName: string;
  status: BookingStatus;
  startTime: Date;
  createdAt: Date;
}

export interface ActivityRow {
  id: string;
  action: string;
  category: ActivityCategory;
  summary: string;
  actorType: ActivityActorType;
  createdAt: Date;
}

export interface AdminBusinessProfile {
  memberSince: Date;
  /** Most recent sign of life (latest booking/client/activity/login). */
  lastActivityAt: Date | null;
  /** When the owner last opened the app (throttled heartbeat). */
  ownerLastSeenAt: Date | null;

  // Revenue & forecast
  forecast: RevenueForecastData;
  lifetimeRevenue: number;
  lifetimeCompletedCount: number;
  monthProfit: number;
  monthExpenses: number;

  // Lifetime booking breakdown
  bookingStatusCounts: Record<BookingStatus, number>;
  totalBookings: number;

  // This-month growth (by creation date)
  newClientsThisMonth: number;
  newBookingsThisMonth: number;
  totalClients: number;

  // Feature usage
  features: FeatureUsage[];
  heavyFeatures: string[];
  lightFeatures: string[];

  // Recent activity
  recentBookings: RecentBookingRow[];
  recentClients: { id: string; fullName: string; createdAt: Date }[];
  lastAutomationRunAt: Date | null;

  /** Real logged actions for this business (auth, bookings, edits, …). */
  recentActivity: ActivityRow[];
}

// ---------------------------------------------------------------------------
// Usage-intensity helper
// ---------------------------------------------------------------------------

/**
 * Classify a raw count into an adoption/intensity level using per-feature
 * thresholds. `lowMax`/`medMax` are the inclusive ceilings for low/medium.
 */
function level(count: number, lowMax: number, medMax: number): UsageLevel {
  if (count <= 0) return "none";
  if (count <= lowMax) return "low";
  if (count <= medMax) return "medium";
  return "high";
}

const ALL_STATUSES: BookingStatus[] = [
  "pending",
  "approved",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
];

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getAdminBusinessProfile(
  businessId: string,
): Promise<AdminBusinessProfile | null> {
  const tenant = { businessId };

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { createdAt: true },
  });
  if (!biz) return null;

  const { start: monthStart, end: monthEnd } = getDateRangeForPeriod("month");

  const [
    forecast,
    finance,
    lifetimeAgg,
    statusGroups,
    activeServices,
    totalClients,
    expensesCount,
    enabledAutomations,
    automationMessagesCount,
    campaignsCount,
    reviewsCount,
    galleryCount,
    waitlistCount,
    loyaltyProgram,
    loyaltyRedemptionsCount,
    newClientsThisMonth,
    newBookingsThisMonth,
    recentBookingsRaw,
    recentClients,
    lastRun,
    ownerMembership,
    recentActivity,
  ] = await Promise.all([
    getRevenueForecastData(tenant),
    getFinanceData(tenant, "month"),
    prisma.booking.aggregate({
      where: { businessId, status: "completed" },
      _sum: { priceSnapshot: true },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { businessId },
      _count: true,
    }),
    prisma.service.count({ where: { businessId, isActive: true } }),
    prisma.client.count({ where: { businessId } }),
    prisma.expense.count({ where: { businessId } }),
    prisma.automationSetting.count({ where: { businessId, enabled: true } }),
    prisma.automationMessage.count({ where: { businessId } }),
    prisma.whatsAppCampaign.count({ where: { businessId } }),
    prisma.clientReview.count({ where: { businessId } }),
    prisma.galleryImage.count({ where: { businessId } }),
    prisma.waitlistEntry.count({ where: { businessId } }),
    prisma.loyaltyProgram.findFirst({
      where: { businessId },
      select: { isActive: true },
    }),
    prisma.loyaltyRedemption.count({ where: { businessId } }),
    prisma.client.count({
      where: { businessId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.booking.count({
      where: { businessId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.booking.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        startTime: true,
        createdAt: true,
        client: { select: { fullName: true } },
        service: { select: { name: true } },
      },
    }),
    prisma.client.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fullName: true, createdAt: true },
    }),
    prisma.automationRun.findFirst({
      where: { businessId },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    prisma.businessUser.findFirst({
      where: { businessId, role: "owner" },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { lastSeenAt: true } } },
    }),
    prisma.activityLog.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        action: true,
        category: true,
        summary: true,
        actorType: true,
        createdAt: true,
      },
    }),
  ]);

  // Lifetime booking status breakdown
  const bookingStatusCounts = ALL_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<BookingStatus, number>,
  );
  let totalBookings = 0;
  for (const g of statusGroups) {
    bookingStatusCounts[g.status] = g._count;
    totalBookings += g._count;
  }

  const loyaltyActive = loyaltyProgram?.isActive ?? false;
  // Adopted-but-unused (program on, no redemptions yet) counts as "low", not "none".
  const loyaltyLevel: UsageLevel = !loyaltyActive
    ? "none"
    : loyaltyRedemptionsCount === 0
      ? "low"
      : level(loyaltyRedemptionsCount, 3, 12);

  // Feature adoption / usage intensity (per-feature thresholds so the level is
  // honest across heterogeneous features).
  const features: FeatureUsage[] = [
    { key: "bookings", label: "תורים", count: totalBookings, level: level(totalBookings, 15, 60) },
    { key: "clients", label: "לקוחות", count: totalClients, level: level(totalClients, 15, 60) },
    { key: "services", label: "שירותים", count: activeServices, level: level(activeServices, 2, 6) },
    { key: "finance", label: "פיננסים והוצאות", count: expensesCount, level: level(expensesCount, 3, 15) },
    {
      key: "automations",
      label: "אוטומציות WhatsApp",
      count: automationMessagesCount,
      level: enabledAutomations > 0 ? level(automationMessagesCount, 10, 50) : "none",
      hint: enabledAutomations > 0 ? `${enabledAutomations} אוטומציות פעילות` : undefined,
    },
    { key: "campaigns", label: "קמפיינים שיווקיים", count: campaignsCount, level: level(campaignsCount, 1, 4) },
    { key: "reviews", label: "ביקורות", count: reviewsCount, level: level(reviewsCount, 3, 15) },
    { key: "gallery", label: "גלריה", count: galleryCount, level: level(galleryCount, 2, 8) },
    { key: "waitlist", label: "רשימת המתנה", count: waitlistCount, level: level(waitlistCount, 1, 5) },
    {
      key: "loyalty",
      label: "מועדון נאמנות",
      count: loyaltyRedemptionsCount,
      level: loyaltyLevel,
      hint: loyaltyActive ? "מועדון פעיל" : undefined,
    },
  ];

  const heavyFeatures = features
    .filter((f) => f.level === "high" || f.level === "medium")
    .map((f) => f.label);
  const lightFeatures = features
    .filter((f) => f.level === "none" || f.level === "low")
    .map((f) => f.label);

  const recentBookings: RecentBookingRow[] = recentBookingsRaw.map((b) => ({
    id: b.id,
    clientName: b.client.fullName,
    serviceName: b.service.name,
    status: b.status,
    startTime: b.startTime,
    createdAt: b.createdAt,
  }));

  const ownerLastSeenAt = ownerMembership?.user.lastSeenAt ?? null;

  // Latest sign of life: newest booking / client / logged action / owner login.
  const lastActivityCandidates = [
    recentBookingsRaw[0]?.createdAt,
    recentClients[0]?.createdAt,
    recentActivity[0]?.createdAt,
    ownerLastSeenAt,
  ].filter((d): d is Date => d instanceof Date);
  const lastActivityAt =
    lastActivityCandidates.length > 0
      ? new Date(Math.max(...lastActivityCandidates.map((d) => d.getTime())))
      : null;

  return {
    memberSince: biz.createdAt,
    lastActivityAt,
    ownerLastSeenAt,

    forecast,
    lifetimeRevenue: Number(lifetimeAgg._sum?.priceSnapshot ?? 0),
    lifetimeCompletedCount: lifetimeAgg._count,
    monthProfit: finance.summary.profit,
    monthExpenses: finance.summary.expenses,

    bookingStatusCounts,
    totalBookings,

    newClientsThisMonth,
    newBookingsThisMonth,
    totalClients,

    features,
    heavyFeatures,
    lightFeatures,

    recentBookings,
    recentClients,
    lastAutomationRunAt: lastRun?.startedAt ?? null,
    recentActivity,
  };
}
