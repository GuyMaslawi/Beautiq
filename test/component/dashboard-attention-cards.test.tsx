// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import type {
  DashboardMetrics,
  SetupState,
  UpcomingBookingItem,
} from "@/server/dashboard/queries";
import type { SuggestedClient } from "@/server/empty-slots/queries";
import type { EmptySlot } from "@/lib/empty-slots/find-empty-slots";

// next/link → plain anchor so hrefs are inspectable in jsdom.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) =>
    React.createElement("a", { href, ...rest }, children),
}));

// Animation wrappers → passthroughs (no framer-motion in jsdom).
vi.mock("@/components/ui/animate", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => children,
  StaggerIn: ({ children }: { children: React.ReactNode }) => children,
  StaggerItem: ({ children }: { children: React.ReactNode }) => children,
}));

import React from "react";

// Routes that were removed or deprioritised — must never appear as an alert
// card destination on the dashboard.
const DEPRECATED_HREFS = [
  "/at-risk",
  "/retention",
  "/reputation",
  "/messages",
  "/pricing",
  "/win-back-campaigns",
  "/revenue-forecast",
  "/empty-slots", // standalone old page — the dashboard anchor is /dashboard#empty-slots
];

const metrics: DashboardMetrics = {
  bookingsToday: 2,
  totalClients: 40,
  activeServices: 5,
  monthRevenue: 3200,
};

const setup: SetupState = {
  hasCategories: true,
  hasActiveService: true,
  hasAvailabilityRule: true,
  hasProfileDetails: true,
  hasAnyBookings: true,
};

const todayBookings: UpcomingBookingItem[] = [
  {
    id: "b1",
    clientName: "דנה",
    serviceName: "מניקור",
    startTimeISO: "2026-06-15T08:00:00.000Z",
    status: "approved",
  },
];

const suggestedClients: SuggestedClient[] = [
  { id: "c1", fullName: "רוני", phone: "0500000001", lastVisitAtISO: null },
  { id: "c2", fullName: "מיכל", phone: "0500000002", lastVisitAtISO: null },
];

const emptySlots: EmptySlot[] = [
  { date: "2026-06-16", weekday: 2, startMinutes: 600, endMinutes: 660, durationMinutes: 60 },
];

/** Render the dashboard with every attention card triggered. */
function renderWithAllAttention() {
  return render(
    <SetupChecklist
      businessName="סטודיו"
      metrics={metrics}
      setup={setup}
      todayBookings={todayBookings}
      upcomingBookings={[]}
      pendingApprovalCount={3}
      guidanceItems={[]}
      emptySlots={emptySlots}
      suggestedClients={suggestedClients}
      atRiskCount={7}
      remindersDueCount={4}
      lateCancellationsCount={1}
    />,
  );
}

/** Collect the <a> elements inside the "requires your attention" column. */
function attentionLinks(): HTMLAnchorElement[] {
  const header = screen.getByText("דורש את תשומת הלב שלך");
  const column = header.parentElement!;
  return Array.from(column.querySelectorAll("a"));
}

describe("dashboard attention cards", () => {
  it("retention/win-back card links to /bring-back with the new copy", () => {
    renderWithAllAttention();
    const link = screen.getByText("לניהול שימור").closest("a")!;
    expect(link.getAttribute("href")).toBe("/bring-back");
    expect(screen.getByText(/לקוחות שמחכות למעקב/)).toBeInTheDocument();
  });

  it("does not render a separate 'לקוחות בסיכון' attention card", () => {
    renderWithAllAttention();
    const labels = attentionLinks().map((a) => a.textContent ?? "");
    expect(labels.some((t) => t.includes("לקוחות בסיכון"))).toBe(false);
  });

  it("never links an attention card to a deprecated route", () => {
    renderWithAllAttention();
    const hrefs = attentionLinks().map((a) => a.getAttribute("href") ?? "");
    for (const href of hrefs) {
      for (const bad of DEPRECATED_HREFS) {
        // exact match or query/anchor variants of the bad standalone route
        expect(href === bad || href.startsWith(`${bad}?`)).toBe(false);
      }
    }
  });

  it("has no duplicate destinations among attention cards", () => {
    renderWithAllAttention();
    const hrefs = attentionLinks().map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("points the empty-slots card at the dashboard anchor, not /bring-back", () => {
    renderWithAllAttention();
    const link = screen.getByText("מילוי חלונות").closest("a")!;
    expect(link.getAttribute("href")).toBe("/dashboard#empty-slots");
  });
});
