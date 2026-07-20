// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));
vi.mock("@/components/ui/animate", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => children,
  StaggerIn: ({ children }: { children: React.ReactNode }) => children,
  StaggerItem: ({ children }: { children: React.ReactNode }) => children,
}));

import React from "react";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import type {
  DashboardMetrics,
  SetupState,
  UpcomingBookingItem,
} from "@/server/dashboard/queries";
import type { RevenueForecastData } from "@/server/revenue-forecast/queries";
import type { SuggestedClient } from "@/server/empty-slots/queries";

const metrics: DashboardMetrics = {
  bookingsToday: 1,
  totalClients: 20,
  activeServices: 3,
  monthRevenue: 1500,
};

const fullSetup: SetupState = {
  hasCategories: true,
  hasActiveService: true,
  hasAvailabilityRule: true,
  hasProfileDetails: true,
  hasAnyBookings: true,
};

const forecast: RevenueForecastData = {
  completedRevenue: 1500,
  completedBookingsCount: 4,
  upcomingRevenue: 0,
  upcomingBookingsCount: 0,
  expectedRevenue: 1800,
  lostRevenue: 0,
  lostBookingsCount: 0,
  lastMonthRevenue: 1200,
  lastMonthCompletedCount: 3,
  monthlyTarget: 1700,
  hasEnoughData: false, // calm not-enough-data path
  targetReliable: false,
  gapToTarget: 200,
  isOnTrack: false,
  daysPassed: 10,
  totalDays: 30,
  expectedProgressPct: 33,
  actualProgressPct: 40,
  avgBookingValue: 375,
  confidence: "low",
  topServices: [],
  atRiskCount: 0,
  emptySlotsCount: 0,
  avgServicePrice: 300,
};

const todayBookings: UpcomingBookingItem[] = [
  {
    id: "b1",
    clientName: "דנה",
    serviceName: "מניקור",
    startTimeISO: "2026-06-21T08:00:00.000Z",
    status: "approved",
  },
  {
    id: "b2",
    clientName: "רוני",
    serviceName: "פדיקור",
    startTimeISO: "2026-06-21T10:00:00.000Z",
    status: "pending",
  },
];

describe("SetupChecklist — calm / no-attention branches", () => {
  it("renders the two-column today layout when nothing needs attention", () => {
    render(
      <SetupChecklist
        businessName="הסטודיו"
        metrics={metrics}
        setup={fullSetup}
        todayBookings={todayBookings}
        upcomingBookings={[]}
        guidanceItems={[]}
        emptySlots={[]}
        suggestedClients={[]}
        atRiskCount={0}
        remindersDueCount={0}
        forecast={forecast}
        reviewReadyCount={0}
        recentRuns={[]}      />,
    );
    // Calm state: nothing urgent → the side rail shows the "all under control"
    // card instead of any attention cards.
    expect(screen.getByText("הכול תחת שליטה")).toBeInTheDocument();
    // Today's bookings render in the timeline
    expect(screen.getByText("דנה")).toBeInTheDocument();
    expect(screen.getByText("רוני")).toBeInTheDocument();
    // Hero metrics
    expect(screen.getByText("פגישות היום")).toBeInTheDocument();
  });

  it("renders the waitlist opportunity card when there are waiting clients", () => {
    render(
      <SetupChecklist
        businessName="הסטודיו"
        metrics={metrics}
        setup={fullSetup}
        todayBookings={[]}
        upcomingBookings={[]}
        guidanceItems={[]}
        emptySlots={[]}
        suggestedClients={[]}
        atRiskCount={0}
        remindersDueCount={0}
        waitlistCount={3}
        forecast={forecast}
        reviewReadyCount={0}
        recentRuns={[]}      />,
    );
    expect(screen.getByText("ממתינות ברשימת המתנה")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /לרשימת ההמתנה/ }).getAttribute("href")).toBe(
      "/waitlist",
    );
    // Empty today panel state
    expect(screen.getByText("אין פגישות להיום")).toBeInTheDocument();
  });

  it("shows the follow-up clients preview and the setup progress ribbon when incomplete", () => {
    const suggested: SuggestedClient[] = [
      { id: "c1", fullName: "מיכל", phone: "0500000001", lastVisitAtISO: "2026-01-01T00:00:00Z" },
      { id: "c2", fullName: "נועה", phone: "0500000002", lastVisitAtISO: null },
    ];
    render(
      <SetupChecklist
        businessName="הסטודיו"
        metrics={metrics}
        setup={{ ...fullSetup, hasAvailabilityRule: false }} // incomplete → ribbon shows
        todayBookings={todayBookings}
        upcomingBookings={todayBookings}
        guidanceItems={[]}
        emptySlots={[]}
        suggestedClients={suggested}
        atRiskCount={2}
        remindersDueCount={1}
        forecast={forecast}
        reviewReadyCount={4}
        recentRuns={[]}      />,
    );
    expect(screen.getByText("לקוחות למעקב ושימור")).toBeInTheDocument();
    expect(screen.getByText("מיכל")).toBeInTheDocument();
    // Setup ribbon (incomplete progress) — the ribbon title is unique.
    expect(screen.getByText("הגדרת העסק")).toBeInTheDocument();
  });

  it("surfaces an extra urgent guidance item as an attention card", () => {
    render(
      <SetupChecklist
        businessName="הסטודיו"
        metrics={metrics}
        setup={fullSetup}
        todayBookings={[]}
        upcomingBookings={[]}
        guidanceItems={[
          {
            id: "deposit-missing",
            priority: "important",
            title: "חסרה מקדמה",
            description: "לתור הזה עדיין לא סומנה מקדמה",
            href: "/bookings",
            actionLabel: "לסימון מקדמה",
          },
        ]}
        emptySlots={[]}
        suggestedClients={[]}
        atRiskCount={0}
        remindersDueCount={0}
        forecast={forecast}
        reviewReadyCount={0}
        recentRuns={[]}      />,
    );
    expect(screen.getByText("דורש את תשומת הלב שלך")).toBeInTheDocument();
    // The attention card renders "{count} {label}" across text nodes — match on content.
    expect(
      screen.getByText((_, el) => el?.textContent === "! חסרה מקדמה"),
    ).toBeInTheDocument();
    expect(screen.getByText("לתור הזה עדיין לא סומנה מקדמה")).toBeInTheDocument();
  });
});
