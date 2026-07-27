// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import React from "react";
import { AutomationsSection } from "@/components/dashboard/automations-section";
import type { RecentAutomationRun } from "@/server/automations/queries";

const baseProps = {
  remindersDueCount: 0,
  recentRuns: [] as RecentAutomationRun[],
};

describe("AutomationsSection (Allura-managed notifications)", () => {
  it("reassures the owner that WhatsApp notifications are active by Allura", () => {
    render(<AutomationsSection {...baseProps} />);
    expect(screen.getByText("התראות WhatsApp פעילות")).toBeInTheDocument();
    expect(screen.getByText("מנוהל על ידי Allura")).toBeInTheDocument();
    expect(screen.getByText(/שליחת ה-WhatsApp מנוהלת על ידי Allura/)).toBeInTheDocument();
  });

  it("is purely informational — it links to nothing (no setup task)", () => {
    const { container } = render(<AutomationsSection {...baseProps} />);
    expect(container.querySelectorAll("a").length).toBe(0);
  });

  it("lists the default operational notifications", () => {
    render(<AutomationsSection {...baseProps} />);
    expect(screen.getByText("אישור תור אחרי קביעה")).toBeInTheDocument();
    expect(screen.getByText("תזכורת לפני התור")).toBeInTheDocument();
    expect(screen.getByText("בקשת ביקורת אחרי הטיפול")).toBeInTheDocument();
  });

  it("shows the empty activity state when there are no runs", () => {
    render(<AutomationsSection {...baseProps} />);
    expect(screen.getByText("אין פעילות אחרונה")).toBeInTheDocument();
  });

  it("renders the recent runs with localized type labels and relative days", () => {
    const today = new Date().toISOString();
    render(
      <AutomationsSection
        {...baseProps}
        recentRuns={[
          { id: "r1", type: "booking_confirmation", status: "done", sentCount: 5, startedAtISO: today },
          { id: "r2", type: "morning_reminder", status: "done", sentCount: 3, startedAtISO: today },
        ]}
      />,
    );
    expect(screen.getByText("אישור תור")).toBeInTheDocument();
    expect(screen.getByText("5 נשלחו · היום")).toBeInTheDocument();
    expect(screen.getByText("תזכורת לתור")).toBeInTheDocument();
    expect(screen.getByText("3 נשלחו · היום")).toBeInTheDocument();
    // סיכום כולל של השליחות האחרונות
    expect(screen.getByText(/סה״כ 8 הודעות/)).toBeInTheDocument();
  });

  it("surfaces the reminders-due count when reminders are pending", () => {
    render(<AutomationsSection {...baseProps} remindersDueCount={4} />);
    expect(screen.getByText(/4 תזכורות יישלחו/)).toBeInTheDocument();
  });
});
