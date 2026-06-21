// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { FinanceData } from "@/server/finance/queries";
import type { RevenueForecastData } from "@/server/revenue-forecast/queries";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  deleteExpenseAction: vi.fn(() => Promise.resolve({ success: "ההוצאה נמחקה" })),
  addExpenseAction: vi.fn(() => Promise.resolve({})),
  updateExpenseAction: vi.fn(() => Promise.resolve({})),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push, refresh: vi.fn() }),
  usePathname: () => "/finance",
  useSearchParams: () => m.searchParams,
}));

vi.mock("@/server/finance/actions", () => ({
  deleteExpenseAction: m.deleteExpenseAction,
  addExpenseAction: m.addExpenseAction,
  updateExpenseAction: m.updateExpenseAction,
}));

import { FinancePageClient } from "@/components/finance/finance-page-client";

function makeData(o: Partial<FinanceData> = {}): FinanceData {
  return {
    summary: {
      revenue: 5000,
      expenses: 1200,
      profit: 3800,
      expensePct: 24,
      completedBookings: 12,
      avgBookingValue: 417,
      upcomingRevenue: 800,
      upcomingBookingsCount: 2,
    },
    topServices: [
      { serviceId: "s1", serviceName: "מניקור", bookingsCount: 8, revenue: 2400, avgPrice: 300 },
    ],
    expenses: [
      { id: "e1", description: "שכירות", category: "rent", date: "2026-06-01", amount: 1200, notes: "יוני" },
    ],
    ...o,
  };
}

function makeForecast(o: Partial<RevenueForecastData> = {}): RevenueForecastData {
  return {
    completedRevenue: 5000,
    completedBookingsCount: 12,
    upcomingRevenue: 800,
    upcomingBookingsCount: 2,
    expectedRevenue: 5800,
    lostRevenue: 200,
    lostBookingsCount: 1,
    lastMonthRevenue: 5200,
    lastMonthCompletedCount: 11,
    monthlyTarget: 5980,
    hasEnoughData: true,
    targetReliable: true,
    gapToTarget: 180,
    isOnTrack: false,
    daysPassed: 15,
    totalDays: 30,
    expectedProgressPct: 50,
    actualProgressPct: 48,
    avgBookingValue: 417,
    confidence: "high",
    topServices: [],
    atRiskCount: 3,
    emptySlotsCount: 2,
    avgServicePrice: 300,
    ...o,
  } as RevenueForecastData;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.searchParams = new URLSearchParams();
  m.deleteExpenseAction.mockResolvedValue({ success: "ההוצאה נמחקה" });
});

describe("FinancePageClient — summary & period filter", () => {
  it("renders the period filter and the three summary cards", () => {
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    expect(screen.getByRole("button", { name: "היום" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "השבוע" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "החודש" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "השנה" })).toBeInTheDocument();
    // "הכנסות בפועל" appears in the summary card and the profit visual.
    expect(screen.getAllByText("הכנסות בפועל").length).toBeGreaterThan(0);
    expect(screen.getAllByText("רווח משוער").length).toBeGreaterThan(0);
    // revenue value, he-IL formatted
    expect(screen.getAllByText("₪5,000").length).toBeGreaterThan(0);
  });

  it("clicking a period pushes the new period query to the router", async () => {
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    await user.click(screen.getByRole("button", { name: "השנה" }));
    expect(m.push).toHaveBeenCalledWith("/finance?period=year");
  });

  it("preserves existing query params when switching periods", async () => {
    m.searchParams = new URLSearchParams("foo=bar");
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    await user.click(screen.getByRole("button", { name: "היום" }));
    expect(m.push).toHaveBeenCalledWith(expect.stringContaining("foo=bar"));
    expect(m.push).toHaveBeenCalledWith(expect.stringContaining("period=today"));
  });
});

describe("FinancePageClient — profit / overspend branches", () => {
  it("shows the overspend warning and a negative profit when expenses exceed revenue", () => {
    render(
      <FinancePageClient
        data={makeData({
          summary: {
            revenue: 1000,
            expenses: 1500,
            profit: -500,
            expensePct: 150,
            completedBookings: 3,
            avgBookingValue: 333,
            upcomingRevenue: 0,
            upcomingBookingsCount: 0,
          },
        })}
        period="month"
        forecast={makeForecast({ hasEnoughData: false })}
      />,
    );
    expect(screen.getByText("ההוצאות גבוהות מההכנסות בתקופה הזו.")).toBeInTheDocument();
    // negative profit prefixed with "-" (summary card + profit visual bar)
    expect(screen.getAllByText("-₪500").length).toBeGreaterThan(0);
  });

  it("shows the no-revenue empty state when revenue is zero", () => {
    render(
      <FinancePageClient
        data={makeData({
          summary: {
            revenue: 0,
            expenses: 0,
            profit: 0,
            expensePct: 0,
            completedBookings: 0,
            avgBookingValue: 0,
            upcomingRevenue: 0,
            upcomingBookingsCount: 0,
          },
          topServices: [],
          expenses: [],
        })}
        period="month"
        forecast={makeForecast({ hasEnoughData: false })}
      />,
    );
    expect(screen.getByText("אין עדיין הכנסות בתקופה הזו.")).toBeInTheDocument();
    expect(screen.getByText("כשתורים יושלמו, ההכנסות יופיעו כאן.")).toBeInTheDocument();
  });

  it("shows the upcoming-revenue banner when upcoming revenue is positive", () => {
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    // The phrase appears in the banner label and its note line.
    expect(screen.getAllByText(/הכנסה צפויה מתורים עתידיים/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 תורים/).length).toBeGreaterThan(0);
  });

  it("renders the profit visual and the no-expenses helper when expenses are zero", () => {
    render(
      <FinancePageClient
        data={makeData({
          summary: {
            revenue: 3000,
            expenses: 0,
            profit: 3000,
            expensePct: 0,
            completedBookings: 5,
            avgBookingValue: 600,
            upcomingRevenue: 0,
            upcomingBookingsCount: 0,
          },
          expenses: [],
        })}
        period="month"
        forecast={makeForecast({ hasEnoughData: false })}
      />,
    );
    expect(screen.getByText("פירוט כספי")).toBeInTheDocument();
    expect(
      screen.getByText("עדיין לא נוספו הוצאות, לכן הרווח המשוער שווה להכנסות בפועל."),
    ).toBeInTheDocument();
  });
});

describe("FinancePageClient — top services", () => {
  it("renders a top-service row with bookings count and revenue", () => {
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    expect(screen.getByText("שירותים שהכניסו הכי הרבה")).toBeInTheDocument();
    expect(screen.getByText("מניקור")).toBeInTheDocument();
    expect(screen.getByText("₪2,400")).toBeInTheDocument();
  });

  it("shows the empty top-services message when there are none", () => {
    render(
      <FinancePageClient data={makeData({ topServices: [] })} period="month" forecast={makeForecast()} />,
    );
    expect(screen.getByText("אין עדיין נתונים לתקופה הזו.")).toBeInTheDocument();
  });
});

describe("FinancePageClient — target vs actual (forecast)", () => {
  it("renders the monthly target block when there is enough data", () => {
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    expect(screen.getByText("יעד מול ביצוע · החודש")).toBeInTheDocument();
    expect(screen.getByText("דיוק גבוה")).toBeInTheDocument();
    // "פער ליעד" is both the key-number label and a composition segment label.
    expect(screen.getAllByText("פער ליעד").length).toBeGreaterThan(0);
  });

  it("shows the on-track checkmark when the gap is closed", () => {
    render(
      <FinancePageClient
        data={makeData()}
        period="month"
        forecast={makeForecast({ gapToTarget: 0, isOnTrack: true })}
      />,
    );
    expect(screen.getByText("✓ ביעד")).toBeInTheDocument();
    expect(screen.getByText("עמידה ביעד")).toBeInTheDocument();
  });

  it("hides the target block entirely when there is not enough data", () => {
    render(
      <FinancePageClient data={makeData()} period="month" forecast={makeForecast({ hasEnoughData: false })} />,
    );
    expect(screen.queryByText("יעד מול ביצוע · החודש")).not.toBeInTheDocument();
  });
});

describe("FinancePageClient — expenses CRUD", () => {
  it("lists existing expenses with date, category and amount", () => {
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    // "שכירות" appears as the description and the category badge.
    expect(screen.getAllByText("שכירות").length).toBeGreaterThanOrEqual(2);
    // amount appears in the expenses summary card and the expense row.
    expect(screen.getAllByText("₪1,200").length).toBeGreaterThan(0);
  });

  it("opens the add-expense modal from the header button", async () => {
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    await user.click(screen.getByRole("button", { name: /הוספת הוצאה/ }));
    // modal title
    expect(await screen.findByRole("heading", { name: "הוספת הוצאה" })).toBeInTheDocument();
  });

  it("opens the edit modal prefilled when an expense row's edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    await user.click(screen.getByRole("button", { name: "עריכה" }));
    expect(await screen.findByRole("heading", { name: "עריכת הוצאה" })).toBeInTheDocument();
    expect((document.querySelector('input[name="expenseId"]') as HTMLInputElement).value).toBe("e1");
  });

  it("deletes an expense after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    await user.click(screen.getByRole("button", { name: "מחיקה" }));
    expect(confirmSpy).toHaveBeenCalledWith("למחוק את ההוצאה?");
    await waitFor(() => expect(m.deleteExpenseAction).toHaveBeenCalledWith("e1"));
    confirmSpy.mockRestore();
  });

  it("does NOT delete when the confirmation is dismissed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    await user.click(screen.getByRole("button", { name: "מחיקה" }));
    expect(m.deleteExpenseAction).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows the empty-expenses state with its CTA when there are no expenses", async () => {
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData({ expenses: [] })} period="month" forecast={makeForecast()} />);
    expect(screen.getByText("עדיין לא נוספו הוצאות.")).toBeInTheDocument();
    // empty-state CTA opens the add modal too
    await user.click(screen.getByRole("button", { name: /הוספת הוצאה ראשונה/ }));
    expect(await screen.findByRole("heading", { name: "הוספת הוצאה" })).toBeInTheDocument();
  });

  it("closes the modal via the cancel button", async () => {
    const user = userEvent.setup();
    render(<FinancePageClient data={makeData()} period="month" forecast={makeForecast()} />);
    await user.click(screen.getByRole("button", { name: /הוספת הוצאה/ }));
    expect(await screen.findByRole("heading", { name: "הוספת הוצאה" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ביטול" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "הוספת הוצאה" })).not.toBeInTheDocument(),
    );
  });
});
