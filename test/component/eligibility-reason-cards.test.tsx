// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EligibilityReasonCards } from "@/components/automations/eligibility-reason-cards";
import type { BlockedClientsByReason, BlockedClientPreview } from "@/server/win-back-automation/shared-types";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

const EMPTY_REASON_LISTS = {
  invalidPhone: [] as BlockedClientPreview[],
  unsubscribed: [] as BlockedClientPreview[],
  noOptIn: [] as BlockedClientPreview[],
  noMarketingOptIn: [] as BlockedClientPreview[],
  hasFutureBooking: [] as BlockedClientPreview[],
  inCooldown: [] as BlockedClientPreview[],
  noCompletedBooking: [] as BlockedClientPreview[],
};

function makeBlocked(over: Partial<BlockedClientsByReason> = {}): BlockedClientsByReason {
  return {
    ...EMPTY_REASON_LISTS,
    counts: {
      total: 0,
      eligible: 0,
      invalidPhone: 0,
      unsubscribed: 0,
      noOptIn: 0,
      noMarketingOptIn: 0,
      hasFutureBooking: 0,
      inCooldown: 0,
      noCompletedBooking: 0,
    },
    ...over,
  } as BlockedClientsByReason;
}

describe("EligibilityReasonCards — summary", () => {
  it("renders the eligible and blocked counts", () => {
    render(
      <EligibilityReasonCards
        blockedClients={makeBlocked({
          counts: { ...makeBlocked().counts, total: 5, eligible: 3, invalidPhone: 2 },
          invalidPhone: [],
        })}
        realSendConfigured
        whatsappConnected
      />,
    );
    expect(screen.getByText("זכאיות לשליחה")).toBeInTheDocument();
    expect(screen.getByText("לא זכאיות")).toBeInTheDocument();
    // eligible 3
    expect(screen.getByText("3")).toBeInTheDocument();
    // blocked = total - eligible = 2
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the 'no clients' message when total is 0", () => {
    render(
      <EligibilityReasonCards blockedClients={makeBlocked()} realSendConfigured whatsappConnected />,
    );
    expect(screen.getByText("אין לקוחות בעסק כרגע.")).toBeInTheDocument();
  });

  it("shows the happy path when all clients are eligible", () => {
    render(
      <EligibilityReasonCards
        blockedClients={makeBlocked({
          counts: { ...makeBlocked().counts, total: 4, eligible: 4 },
        })}
        realSendConfigured
        whatsappConnected
      />,
    );
    expect(screen.getByText("כל הלקוחות הפעילות זכאיות לשליחה")).toBeInTheDocument();
    expect(screen.getByText(/4 הלקוחות/)).toBeInTheDocument();
  });
});

describe("EligibilityReasonCards — WhatsApp not connected", () => {
  it("shows the dev-mode notice when real send is not configured", () => {
    render(
      <EligibilityReasonCards
        blockedClients={makeBlocked({ counts: { ...makeBlocked().counts, total: 1, eligible: 1 } })}
        realSendConfigured={false}
        whatsappConnected={false}
      />,
    );
    expect(screen.getByText("WhatsApp לא מחובר")).toBeInTheDocument();
    expect(screen.getByText(/העסק עדיין לא מגדיר WhatsApp Business/)).toBeInTheDocument();
  });

  it("shows the inactive-connection notice when configured but disconnected", () => {
    render(
      <EligibilityReasonCards
        blockedClients={makeBlocked({ counts: { ...makeBlocked().counts, total: 1, eligible: 1 } })}
        realSendConfigured
        whatsappConnected={false}
      />,
    );
    expect(screen.getByText(/חיבור WhatsApp Business לא פעיל/)).toBeInTheDocument();
  });
});

describe("EligibilityReasonCards — blocked reason cards", () => {
  const blocked = makeBlocked({
    counts: {
      ...makeBlocked().counts,
      total: 4,
      eligible: 1,
      invalidPhone: 2,
      hasFutureBooking: 1,
    },
    invalidPhone: [
      { id: "c1", fullName: "רוני לוי", maskedPhone: "***1234" },
      { id: "c2", fullName: "מיכל בר", maskedPhone: "***5678" },
    ],
    hasFutureBooking: [{ id: "c3", fullName: "תמר", maskedPhone: "***9999" }],
  });

  it("renders one card per active reason with its count", () => {
    render(<EligibilityReasonCards blockedClients={blocked} realSendConfigured whatsappConnected />);
    expect(screen.getByText("למה חלק מהלקוחות לא יקבלו הודעה?")).toBeInTheDocument();
    expect(screen.getByText("אין מספר טלפון תקין")).toBeInTheDocument();
    expect(screen.getByText("יש לה תור עתידי")).toBeInTheDocument();
    expect(screen.getByText("2 לקוחות")).toBeInTheDocument();
    expect(screen.getByText("1 לקוחות")).toBeInTheDocument();
  });

  it("expands a reason card to show client names and details links", async () => {
    const user = userEvent.setup();
    render(<EligibilityReasonCards blockedClients={blocked} realSendConfigured whatsappConnected />);

    // The invalidPhone card has a 'הצג לקוחות' toggle.
    const toggles = screen.getAllByRole("button", { name: /הצג לקוחות/ });
    await user.click(toggles[0]);

    expect(screen.getByText("רוני לוי")).toBeInTheDocument();
    expect(screen.getByText("מיכל בר")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /פרטים/ });
    expect(links.some((a) => a.getAttribute("href") === "/clients/c1")).toBe(true);
  });

  it("shows a fixable hint with a lightbulb for invalid phone", () => {
    render(<EligibilityReasonCards blockedClients={blocked} realSendConfigured whatsappConnected />);
    expect(screen.getByText(/כדאי לעדכן מספר טלפון/)).toBeInTheDocument();
  });

  it("renders a '50 limit' note when a reason has exactly 50 clients", async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      fullName: `לקוחה ${i}`,
      maskedPhone: "***0000",
    }));
    const big = makeBlocked({
      counts: { ...makeBlocked().counts, total: 60, eligible: 10, inCooldown: 50 },
      inCooldown: fifty,
    });
    const user = userEvent.setup();
    render(<EligibilityReasonCards blockedClients={big} realSendConfigured whatsappConnected />);
    await user.click(screen.getByRole("button", { name: /הצג לקוחות/ }));
    expect(screen.getByText("מוצגות עד 50 לקוחות לכל סיבה")).toBeInTheDocument();
  });
});
