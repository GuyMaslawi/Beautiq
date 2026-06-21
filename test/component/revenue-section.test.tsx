// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import React from "react";
import { RevenueSection } from "@/components/dashboard/revenue-section";
import type { RevenueForecastData } from "@/server/revenue-forecast/queries";

function forecast(over: Partial<RevenueForecastData> = {}): RevenueForecastData {
  return {
    completedRevenue: 3200,
    completedBookingsCount: 8,
    upcomingRevenue: 800,
    upcomingBookingsCount: 2,
    expectedRevenue: 4000,
    lostRevenue: 0,
    lostBookingsCount: 0,
    lastMonthRevenue: 3000,
    lastMonthCompletedCount: 7,
    monthlyTarget: 3450,
    hasEnoughData: true,
    targetReliable: true,
    gapToTarget: 0,
    isOnTrack: true,
    daysPassed: 15,
    totalDays: 30,
    expectedProgressPct: 50,
    actualProgressPct: 90,
    avgBookingValue: 400,
    confidence: "high",
    topServices: [],
    atRiskCount: 7,
    emptySlotsCount: 3,
    avgServicePrice: 350,
    ...over,
  };
}

describe("RevenueSection", () => {
  it("renders the calm not-enough-data state", () => {
    render(<RevenueSection forecast={forecast({ hasEnoughData: false })} />);
    expect(screen.getByText("הכנסה החודש")).toBeInTheDocument();
    expect(screen.getByText("תחזית הכנסות")).toBeInTheDocument();
    // No end-of-month forecast hero yet
    expect(screen.queryByText("צפי לסוף החודש")).not.toBeInTheDocument();
  });

  it("renders the forecast hero with confidence label and target when on track", () => {
    render(<RevenueSection forecast={forecast({ confidence: "high", isOnTrack: true, gapToTarget: 0 })} />);
    expect(screen.getByText("צפי לסוף החודש")).toBeInTheDocument();
    expect(screen.getByText("דיוק גבוה")).toBeInTheDocument();
    expect(screen.getByText("₪4,000")).toBeInTheDocument();
    // gapClosed → the ✓ supporting metric
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText(/עמידה ביעד/)).toBeInTheDocument();
  });

  it("renders the gap-to-target metric when behind", () => {
    render(
      <RevenueSection
        forecast={forecast({ isOnTrack: false, gapToTarget: 500, confidence: "medium" })}
      />,
    );
    expect(screen.getByText("דיוק בינוני")).toBeInTheDocument();
    expect(screen.getByText("₪500")).toBeInTheDocument();
    expect(screen.getByText(/פער ליעד/)).toBeInTheDocument();
  });

  it("renders the low-confidence label and hides the target bar when target is 0", () => {
    render(
      <RevenueSection
        forecast={forecast({ confidence: "low", monthlyTarget: 0, isOnTrack: false, gapToTarget: 100 })}
      />,
    );
    expect(screen.getByText("דיוק ראשוני")).toBeInTheDocument();
    expect(screen.queryByText(/יעד החודש/)).not.toBeInTheDocument();
  });

  it("links every card to /finance", () => {
    render(<RevenueSection forecast={forecast()} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.getAttribute("href")).toBe("/finance");
  });
});
