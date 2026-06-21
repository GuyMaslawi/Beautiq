// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import React from "react";
import { AutomationsSection } from "@/components/dashboard/automations-section";
import type { RecentAutomationRun } from "@/server/automations/queries";

const baseProps = {
  whatsappLabel: "WhatsApp מוכן לשליחה",
  whatsappReady: true,
  whatsappConnected: true,
  remindersDueCount: 0,
  recentRuns: [] as RecentAutomationRun[],
};

describe("AutomationsSection", () => {
  it("renders three status cards all linking to /automations", () => {
    render(<AutomationsSection {...baseProps} />);
    expect(screen.getByText("חיבור WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("אוטומציות")).toBeInTheDocument();
    expect(screen.getByText("פעילות אחרונה")).toBeInTheDocument();
    for (const a of screen.getAllByRole("link")) {
      expect(a.getAttribute("href")).toBe("/automations");
    }
  });

  it("shows the ready state when WhatsApp is ready and no reminders are due", () => {
    render(<AutomationsSection {...baseProps} />);
    expect(screen.getByText("פעילות ומוכנות")).toBeInTheDocument();
    expect(screen.getByText("אין פעילות אחרונה")).toBeInTheDocument();
  });

  it("shows reminders-due count with the waiting sub-label", () => {
    render(<AutomationsSection {...baseProps} remindersDueCount={4} />);
    expect(screen.getByText("4 תזכורות מוכנות")).toBeInTheDocument();
    expect(screen.getByText("ממתינות לשליחה ללקוחות")).toBeInTheDocument();
  });

  it("shows the 'awaiting setup' state when not ready and not connected", () => {
    render(
      <AutomationsSection {...baseProps} whatsappReady={false} whatsappConnected={false} />,
    );
    expect(screen.getByText("ממתינות להגדרה")).toBeInTheDocument();
  });

  it("renders the most recent run with a localized type label and relative day", () => {
    const today = new Date().toISOString();
    render(
      <AutomationsSection
        {...baseProps}
        recentRuns={[
          { id: "r1", type: "win_back", status: "done", sentCount: 5, startedAtISO: today },
        ]}
      />,
    );
    expect(screen.getByText("החזרת לקוחות · 5 נשלחו")).toBeInTheDocument();
    expect(screen.getByText("היום")).toBeInTheDocument();
  });

  it("falls back to the raw run type when unmapped", () => {
    const iso = new Date().toISOString();
    render(
      <AutomationsSection
        {...baseProps}
        recentRuns={[
          { id: "r2", type: "custom_type", status: "done", sentCount: 1, startedAtISO: iso },
        ]}
      />,
    );
    expect(screen.getByText("custom_type · 1 נשלחו")).toBeInTheDocument();
  });
});
