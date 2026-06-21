// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const auth = vi.hoisted(() => ({ requireCurrentBusiness: vi.fn() }));
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: auth.requireCurrentBusiness,
}));

// Child cards → light passthroughs that surface identifying text only.
vi.mock("@/components/retention/retention-client-card", () => ({
  RetentionClientCard: ({ client }: { client: { fullName: string } }) =>
    React.createElement("div", { "data-testid": "retention-card" }, client.fullName),
}));
vi.mock("@/components/reputation/reputation-booking-card", () => ({
  ReputationBookingCard: ({ booking }: { booking: { clientName: string } }) =>
    React.createElement("div", { "data-testid": "reputation-card" }, booking.clientName),
}));
vi.mock("@/components/at-risk/at-risk-client-card", () => ({
  AtRiskClientCard: ({ client }: { client: { fullName: string } }) =>
    React.createElement("div", { "data-testid": "at-risk-card" }, client.fullName),
}));
vi.mock("@/components/bring-back/bring-back-hub", () => ({
  BringBackHub: ({ clients }: { clients: unknown[] }) =>
    React.createElement("div", { "data-testid": "hub" }, `clients:${clients.length}`),
}));
vi.mock("@/components/win-back-campaigns/campaign-view", () => ({
  CampaignView: ({ defaultCampaignType }: { defaultCampaignType?: string }) =>
    React.createElement("div", { "data-testid": "campaign" }, defaultCampaignType ?? "none"),
}));
vi.mock("@/components/messages/smart-composer", () => ({
  SmartComposer: () => React.createElement("div", { "data-testid": "composer" }),
}));
vi.mock("@/components/messages/message-template-card", () => ({
  MessageTemplateCard: ({ type }: { type: string }) =>
    React.createElement("div", { "data-testid": "tpl" }, type),
}));

// Query modules
const q = vi.hoisted(() => ({
  getRetentionClients: vi.fn(),
  getRetentionSummary: vi.fn(),
  getReputationBookings: vi.fn(),
  getReputationSummary: vi.fn(),
  getAtRiskClients: vi.fn(),
  getEmptySlotsData: vi.fn(),
  getBringBackClients: vi.fn(),
  getWinBackAllCampaigns: vi.fn(),
  getSystemTemplates: vi.fn(),
  getComposerData: vi.fn(),
}));
vi.mock("@/server/retention/queries", () => ({
  getRetentionClients: q.getRetentionClients,
  getRetentionSummary: q.getRetentionSummary,
}));
vi.mock("@/server/reputation/queries", () => ({
  getReputationBookings: q.getReputationBookings,
  getReputationSummary: q.getReputationSummary,
}));
vi.mock("@/server/at-risk/queries", () => ({
  getAtRiskClients: q.getAtRiskClients,
}));
vi.mock("@/server/empty-slots/queries", () => ({
  getEmptySlotsData: q.getEmptySlotsData,
}));
vi.mock("@/server/bring-back/queries", async (orig) => {
  const actual = await orig<typeof import("@/server/bring-back/queries")>();
  return { ...actual, getBringBackClients: q.getBringBackClients };
});
vi.mock("@/server/win-back-campaigns/queries", async (orig) => {
  const actual = await orig<typeof import("@/server/win-back-campaigns/queries")>();
  return { ...actual, getWinBackAllCampaigns: q.getWinBackAllCampaigns };
});
vi.mock("@/server/messages/queries", () => ({
  getSystemTemplates: q.getSystemTemplates,
  getComposerData: q.getComposerData,
}));

import React from "react";
import { RetentionSection } from "@/components/bring-back/sections/retention-section";
import { ReputationSection } from "@/components/bring-back/sections/reputation-section";
import { AtRiskSection } from "@/components/bring-back/sections/at-risk-section";
import { EmptySlotsSection } from "@/components/bring-back/sections/empty-slots-section";
import { BringBackOverviewSection } from "@/components/bring-back/sections/bring-back-overview-section";
import { WinBackSection } from "@/components/bring-back/sections/win-back-section";
import { MessagesSection } from "@/components/bring-back/sections/messages-section";

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireCurrentBusiness.mockResolvedValue({ id: "biz-1", name: "הסטודיו" });
});

async function renderAsync(el: Promise<React.ReactElement>) {
  render(await el);
}

// ── RetentionSection ──────────────────────────────────────────────────────────

describe("RetentionSection", () => {
  it("renders the empty state when there are no clients", async () => {
    q.getRetentionClients.mockResolvedValue([]);
    q.getRetentionSummary.mockResolvedValue({ notReturnedCount: 0, withUpcomingCount: 0 });
    await renderAsync(RetentionSection());
    expect(
      screen.getByText("לקוחות שלא חזרו לאחרונה והודעות מוכנות לחידוש קשר."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("retention-card")).not.toBeInTheDocument();
  });

  it("renders a card per client and reflects summary counts", async () => {
    q.getRetentionClients.mockResolvedValue([
      {
        id: "c1",
        fullName: "דנה",
        phone: "0501234567",
        lastCompletedBookingAt: new Date("2026-05-01T08:00:00Z"),
        lastServiceName: "לק ג׳ל",
        daysSinceLastVisit: 40,
        totalCompletedBookings: 3,
        hasNoShow: false,
        hasCancellations: false,
      },
    ]);
    q.getRetentionSummary.mockResolvedValue({ notReturnedCount: 2, withUpcomingCount: 1 });
    await renderAsync(RetentionSection());
    expect(screen.getByTestId("retention-card")).toHaveTextContent("דנה");
    // notReturnedCount value
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

// ── ReputationSection ─────────────────────────────────────────────────────────

describe("ReputationSection", () => {
  it("renders the empty state when there are no completed bookings", async () => {
    q.getReputationBookings.mockResolvedValue([]);
    q.getReputationSummary.mockResolvedValue({ recentCompletedCount: 0 });
    await renderAsync(ReputationSection());
    expect(
      screen.getByText("הכינו הודעות תודה ובקשות ביקורת אחרי טיפולים שהושלמו."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("reputation-card")).not.toBeInTheDocument();
  });

  it("renders a booking card and the completed-date label for today", async () => {
    q.getReputationBookings.mockResolvedValue([
      {
        id: "b1",
        clientId: "c1",
        clientName: "מיכל",
        clientPhone: "0501234567",
        serviceName: "לק ג׳ל",
        completedAt: new Date(),
        price: 120,
        isToday: true,
      },
    ]);
    q.getReputationSummary.mockResolvedValue({ recentCompletedCount: 1 });
    await renderAsync(ReputationSection());
    expect(screen.getByTestId("reputation-card")).toHaveTextContent("מיכל");
  });
});

// ── AtRiskSection ─────────────────────────────────────────────────────────────

describe("AtRiskSection", () => {
  it("renders the empty state with zero summary when no clients", async () => {
    q.getAtRiskClients.mockResolvedValue([]);
    await renderAsync(AtRiskSection());
    expect(screen.queryByTestId("at-risk-card")).not.toBeInTheDocument();
    // Guidance banner only shows when there are clients
    expect(screen.queryByRole("link", { name: /קמפיין/ })).not.toBeInTheDocument();
  });

  it("renders cards, summary counts and a critical win-back link", async () => {
    q.getAtRiskClients.mockResolvedValue([
      {
        id: "c1",
        fullName: "דנה",
        phone: "0501234567",
        lastVisitAt: new Date("2026-01-01T00:00:00Z"),
        lastServiceName: "לק ג׳ל",
        daysSinceLastVisit: 120,
        riskLevel: "critical",
        totalCompletedBookings: 4,
        totalRevenue: 900,
      },
    ]);
    await renderAsync(AtRiskSection());
    expect(screen.getByTestId("at-risk-card")).toHaveTextContent("דנה");
    // Critical → campaign=90 deep link
    const link = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.includes("campaign=90"));
    expect(link).toBeTruthy();
  });
});

// ── EmptySlotsSection ─────────────────────────────────────────────────────────

describe("EmptySlotsSection", () => {
  it("renders the empty state when there are no slots", async () => {
    q.getEmptySlotsData.mockResolvedValue({ slots: [], suggestedClients: [] });
    await renderAsync(EmptySlotsSection());
    expect(screen.getByText("אין חלונות פנויים לשבוע הקרוב")).toBeInTheDocument();
  });

  it("renders slots and suggested clients with wa.me links", async () => {
    q.getEmptySlotsData.mockResolvedValue({
      slots: [
        { date: "2026-06-22", weekday: 1, startMinutes: 600, endMinutes: 720, durationMinutes: 120 },
      ],
      suggestedClients: [
        { id: "c1", fullName: "דנה", phone: "0501234567", lastVisitAtISO: "2026-01-01T00:00:00Z" },
      ],
    });
    await renderAsync(EmptySlotsSection());
    expect(screen.getByText("לקוחות שמומלץ לפנות אליהן")).toBeInTheDocument();
    // Generic slot CTA wa.me link (no phone)
    const links = screen.getAllByRole("link");
    expect(links.some((a) => a.getAttribute("href")?.startsWith("https://wa.me/?text="))).toBe(true);
    // Per-client wa.me link with phone
    expect(
      links.some((a) => /wa\.me\/\+?972501234567/.test(a.getAttribute("href") ?? "")),
    ).toBe(true);
  });
});

// ── BringBackOverviewSection ──────────────────────────────────────────────────

describe("BringBackOverviewSection", () => {
  it("passes serialised clients to the hub and clamps the threshold", async () => {
    q.getBringBackClients.mockResolvedValue([
      {
        id: "c1",
        fullName: "דנה",
        phone: "0501234567",
        lastVisitAt: new Date("2026-01-01T00:00:00Z"),
        lastServiceName: "לק ג׳ל",
        daysSinceLastVisit: 100,
        segment: "critical",
        totalCompletedBookings: 4,
        totalRevenue: 500,
      },
    ]);
    await renderAsync(BringBackOverviewSection({ days: "9999" }));
    expect(screen.getByTestId("hub")).toHaveTextContent("clients:1");
    expect(screen.getByText("החזרת לקוחות")).toBeInTheDocument();
  });
});

// ── WinBackSection ────────────────────────────────────────────────────────────

describe("WinBackSection", () => {
  it("renders the campaign view with a valid default campaign", async () => {
    q.getWinBackAllCampaigns.mockResolvedValue({ "30": [], "60": [], "90": [], vip: [] });
    await renderAsync(WinBackSection({ campaign: "90" }));
    expect(screen.getByTestId("campaign")).toHaveTextContent("90");
  });

  it("ignores an invalid campaign type", async () => {
    q.getWinBackAllCampaigns.mockResolvedValue({ "30": [], "60": [], "90": [], vip: [] });
    await renderAsync(WinBackSection({ campaign: "bogus" }));
    expect(screen.getByTestId("campaign")).toHaveTextContent("none");
  });
});

// ── MessagesSection ───────────────────────────────────────────────────────────

describe("MessagesSection", () => {
  it("renders the composer and template cards", async () => {
    q.getSystemTemplates.mockResolvedValue([
      { id: "t1", type: "booking_confirmation", body: "היי {clientName}" },
    ]);
    q.getComposerData.mockResolvedValue({ bookingOptions: [], clientOptions: [] });
    await renderAsync(MessagesSection());
    expect(screen.getByTestId("composer")).toBeInTheDocument();
    expect(screen.getByTestId("tpl")).toHaveTextContent("booking_confirmation");
  });

  it("renders the no-templates message when empty", async () => {
    q.getSystemTemplates.mockResolvedValue([]);
    q.getComposerData.mockResolvedValue({ bookingOptions: [], clientOptions: [] });
    await renderAsync(MessagesSection());
    expect(screen.getByText("אין תבניות זמינות כרגע")).toBeInTheDocument();
  });
});
