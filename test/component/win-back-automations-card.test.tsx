// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { WinBackAutomationsCard } from "@/components/win-back-automation/win-back-automations-card";
import type { AutomationSetting, WhatsAppConnection } from "@prisma/client";
import type { WinBackStats } from "@/server/win-back-automation/queries";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

function makeStats(overrides: Partial<WinBackStats> = {}): WinBackStats {
  return {
    realSentThisMonth: 0,
    mockRunsThisMonth: 0,
    failedThisMonth: 0,
    skippedThisMonth: 0,
    sentThisMonth: 0,
    ...overrides,
  };
}

function makeSetting(overrides: Partial<AutomationSetting> = {}): AutomationSetting {
  return { enabled: false, thresholdDays: 30, ...overrides } as unknown as AutomationSetting;
}

function activeConnection(): WhatsAppConnection {
  return { status: "active", provider: "meta_cloud_api" } as unknown as WhatsAppConnection;
}

describe("WinBackAutomationsCard", () => {
  it("shows 'פעיל' when enabled and a provider is connected", () => {
    render(
      <WinBackAutomationsCard
        setting={makeSetting({ enabled: true, thresholdDays: 60 } as Partial<AutomationSetting>)}
        connection={activeConnection()}
        stats={makeStats({ realSentThisMonth: 4 })}
      />,
    );
    expect(screen.getByText("החזרת לקוחות אוטומטית")).toBeInTheDocument();
    expect(screen.getByText("פעיל")).toBeInTheDocument();
    // threshold badge
    expect(screen.getByText("60 ימים")).toBeInTheDocument();
    // sent count
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows 'נדרש חיבור' when no provider regardless of enabled flag", () => {
    render(
      <WinBackAutomationsCard
        setting={makeSetting({ enabled: true } as Partial<AutomationSetting>)}
        connection={null}
        stats={makeStats()}
      />,
    );
    expect(screen.getByText("נדרש חיבור")).toBeInTheDocument();
  });

  it("shows 'כבוי' when a provider exists but automation is disabled", () => {
    render(
      <WinBackAutomationsCard
        setting={makeSetting({ enabled: false } as Partial<AutomationSetting>)}
        connection={activeConnection()}
        stats={makeStats()}
      />,
    );
    expect(screen.getByText("כבוי")).toBeInTheDocument();
  });

  it("treats a dev_mock provider as connected", () => {
    render(
      <WinBackAutomationsCard
        setting={makeSetting({ enabled: true } as Partial<AutomationSetting>)}
        connection={{ status: "inactive", provider: "dev_mock" } as unknown as WhatsAppConnection}
        stats={makeStats()}
      />,
    );
    expect(screen.getByText("פעיל")).toBeInTheDocument();
  });

  it("renders the failed-this-month count only when greater than zero", () => {
    const { rerender } = render(
      <WinBackAutomationsCard
        setting={makeSetting()}
        connection={activeConnection()}
        stats={makeStats({ failedThisMonth: 0 })}
      />,
    );
    // 0 failed → no red count besides the (zero) sent count
    expect(screen.queryByText("נכשלו")).not.toBeInTheDocument();

    rerender(
      <WinBackAutomationsCard
        setting={makeSetting()}
        connection={activeConnection()}
        stats={makeStats({ failedThisMonth: 2 })}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("links the manage CTA to /bring-back", () => {
    render(
      <WinBackAutomationsCard setting={makeSetting()} connection={activeConnection()} stats={makeStats()} />,
    );
    const cta = screen.getByText("ניהול אוטומציה").closest("a")!;
    expect(cta.getAttribute("href")).toBe("/bring-back");
  });

  it("does not render a threshold badge when setting is null", () => {
    render(
      <WinBackAutomationsCard setting={null} connection={activeConnection()} stats={makeStats()} />,
    );
    expect(screen.queryByText(/ימים$/)).not.toBeInTheDocument();
    expect(screen.getByText("כבוי")).toBeInTheDocument();
  });
});
