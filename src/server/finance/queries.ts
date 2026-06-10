import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

// ---------------------------------------------------------------------------
// Period helpers — Jerusalem timezone
// ---------------------------------------------------------------------------

const TZ = "Asia/Jerusalem";

function getJerusalemDayStart(refDate: Date): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(refDate);

  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const s = parseInt(parts.find((p) => p.type === "second")!.value, 10);

  return new Date(
    refDate.getTime() - (h * 3600 + m * 60 + s) * 1000 - refDate.getMilliseconds(),
  );
}

export type PeriodFilter = "today" | "week" | "month" | "year";

interface DateRange {
  start: Date;
  end: Date;
}

export function getDateRangeForPeriod(period: PeriodFilter): DateRange {
  const now = new Date();
  const todayStart = getJerusalemDayStart(now);

  if (period === "today") {
    return {
      start: todayStart,
      end: new Date(todayStart.getTime() + 86400000 - 1),
    };
  }

  if (period === "week") {
    // Week starts on Sunday (Israeli week)
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
    const dow = tzDate.getDay(); // 0=Sun
    const weekStart = new Date(todayStart.getTime() - dow * 86400000);
    return {
      start: weekStart,
      end: new Date(weekStart.getTime() + 7 * 86400000 - 1),
    };
  }

  if (period === "month") {
    const ymParts = new Intl.DateTimeFormat("en", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    const year = parseInt(ymParts.find((p) => p.type === "year")!.value, 10);
    const month = parseInt(ymParts.find((p) => p.type === "month")!.value, 10);

    const day1 = getJerusalemDayStart(new Date(Date.UTC(year, month - 1, 1, 12)));
    const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDay = getJerusalemDayStart(new Date(Date.UTC(year, month - 1, lastDayNum, 12)));
    return {
      start: day1,
      end: new Date(lastDay.getTime() + 86400000 - 1),
    };
  }

  // year
  const ymParts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    year: "numeric",
  }).formatToParts(now);
  const year = parseInt(ymParts.find((p) => p.type === "year")!.value, 10);
  const jan1 = getJerusalemDayStart(new Date(Date.UTC(year, 0, 1, 12)));
  const dec31 = getJerusalemDayStart(new Date(Date.UTC(year, 11, 31, 12)));
  return {
    start: jan1,
    end: new Date(dec31.getTime() + 86400000 - 1),
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinanceSummary {
  revenue: number;
  expenses: number;
  profit: number;
  expensePct: number;
  completedBookings: number;
  avgBookingValue: number;
  upcomingRevenue: number;
  upcomingBookingsCount: number;
}

export interface TopService {
  serviceId: string;
  serviceName: string;
  bookingsCount: number;
  revenue: number;
  avgPrice: number;
}

export interface ExpenseItem {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  notes: string | null;
}

export interface FinanceData {
  summary: FinanceSummary;
  topServices: TopService[];
  expenses: ExpenseItem[];
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getFinanceData(
  tenant: TenantContext,
  period: PeriodFilter,
  customFrom?: Date,
  customTo?: Date,
): Promise<FinanceData> {
  const { start, end } = customFrom && customTo
    ? { start: customFrom, end: customTo }
    : getDateRangeForPeriod(period);

  const now = new Date();

  const [
    completedAgg,
    completedBookings,
    upcomingAgg,
    expenseAgg,
    rawExpenses,
  ] = await Promise.all([
    // Revenue: completed bookings in range
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: start, lte: end },
      },
      _sum: { priceSnapshot: true },
      _count: true,
    }),

    // Completed bookings detail for top services
    prisma.booking.findMany({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: start, lte: end },
      },
      select: {
        priceSnapshot: true,
        service: { select: { id: true, name: true } },
      },
    }),

    // Upcoming revenue: future pending/approved bookings in range
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: { in: ["pending", "approved"] },
        startTime: { gt: now, lte: end },
      },
      _sum: { priceSnapshot: true },
      _count: true,
    }),

    // Total expenses in range
    prisma.expense.aggregate({
      where: {
        businessId: tenant.businessId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),

    // Expense list for the range
    prisma.expense.findMany({
      where: {
        businessId: tenant.businessId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const revenue = Number(completedAgg._sum?.priceSnapshot ?? 0);
  const completedCount = completedAgg._count;
  const expenses = Number(expenseAgg._sum?.amount ?? 0);
  const profit = revenue - expenses;
  const expensePct = revenue > 0 ? Math.round((expenses / revenue) * 100) : 0;
  const avgBookingValue = completedCount > 0 ? Math.round(revenue / completedCount) : 0;
  const upcomingRevenue = Number(upcomingAgg._sum?.priceSnapshot ?? 0);
  const upcomingBookingsCount = upcomingAgg._count;

  // Top services by revenue
  const serviceMap = new Map<string, { name: string; count: number; total: number }>();
  for (const b of completedBookings) {
    const svc = b.service;
    const price = Number(b.priceSnapshot ?? 0);
    const existing = serviceMap.get(svc.id);
    if (existing) {
      existing.count += 1;
      existing.total += price;
    } else {
      serviceMap.set(svc.id, { name: svc.name, count: 1, total: price });
    }
  }

  const topServices: TopService[] = Array.from(serviceMap.entries())
    .map(([id, { name, count, total }]) => ({
      serviceId: id,
      serviceName: name,
      bookingsCount: count,
      revenue: total,
      avgPrice: count > 0 ? Math.round(total / count) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const expenseItems: ExpenseItem[] = rawExpenses.map((e) => ({
    id: e.id,
    description: e.description,
    category: e.category,
    date: e.date.toISOString().slice(0, 10),
    amount: Number(e.amount),
    notes: e.notes,
  }));

  return {
    summary: {
      revenue,
      expenses,
      profit,
      expensePct,
      completedBookings: completedCount,
      avgBookingValue,
      upcomingRevenue,
      upcomingBookingsCount,
    },
    topServices,
    expenses: expenseItems,
  };
}

// ---------------------------------------------------------------------------
// Dashboard summary — current month only
// ---------------------------------------------------------------------------

export interface FinanceDashboardSummary {
  revenue: number;
  expenses: number;
  profit: number;
}

export async function getFinanceDashboardSummary(
  tenant: TenantContext,
): Promise<FinanceDashboardSummary> {
  const { start, end } = getDateRangeForPeriod("month");

  const [completedAgg, expenseAgg] = await Promise.all([
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: start, lte: end },
      },
      _sum: { priceSnapshot: true },
    }),
    prisma.expense.aggregate({
      where: {
        businessId: tenant.businessId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const revenue = Number(completedAgg._sum?.priceSnapshot ?? 0);
  const expenses = Number(expenseAgg._sum?.amount ?? 0);

  return { revenue, expenses, profit: revenue - expenses };
}
