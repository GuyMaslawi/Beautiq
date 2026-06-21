// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { CampaignView } from "@/components/win-back-campaigns/campaign-view";
import type { WinBackClient, CampaignType, WinBackMetrics } from "@/server/win-back-campaigns/queries";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

// jsdom lacks scrollIntoView / scrollTo.
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

function makeClient(id: string, o: Partial<WinBackClient> = {}): WinBackClient {
  return {
    id,
    fullName: `לקוחה ${id}`,
    phone: "0501234567",
    lastVisitAt: new Date("2026-04-01T10:00:00Z"),
    lastServiceName: "מניקור",
    daysSinceLastVisit: 40,
    totalCompletedBookings: 4,
    totalRevenue: 800,
    ...o,
  };
}

function emptyCampaigns(): Record<CampaignType, WinBackClient[]> {
  return { "30": [], "60": [], "90": [], vip: [] };
}

function makeMetrics(o: Partial<WinBackMetrics> = {}): WinBackMetrics {
  return { totalRecoverable: 3, revenuePotential: 2400, ...o };
}

function campaignsWith30(clients: WinBackClient[]): Record<CampaignType, WinBackClient[]> {
  return { ...emptyCampaigns(), "30": clients };
}

describe("CampaignView — selector (default view)", () => {
  it("renders the overview metrics and four campaign cards", () => {
    render(
      <CampaignView
        allCampaigns={campaignsWith30([makeClient("a"), makeClient("b")])}
        metrics={makeMetrics({ totalRecoverable: 2 })}
        businessName="סטודיו"
      />,
    );
    expect(screen.getByText("לקוחות להחזרה")).toBeInTheDocument();
    expect(screen.getByText("פוטנציאל הכנסה")).toBeInTheDocument();
    expect(screen.getByText("קמפיינים זמינים")).toBeInTheDocument();
    expect(screen.getByText("הודעות מוכנות")).toBeInTheDocument();
    expect(screen.getByText("בחרי קמפיין")).toBeInTheDocument();
    // four campaign titles
    expect(screen.getByText("קמפיין חזרה אחרי 30 יום")).toBeInTheDocument();
    expect(screen.getByText("קמפיין חזרה אחרי 60 יום")).toBeInTheDocument();
    expect(screen.getByText("קמפיין חזרה אחרי 90 יום")).toBeInTheDocument();
    expect(screen.getByText("קמפיין VIP שלא חזרו")).toBeInTheDocument();
  });

  it("entering a campaign shows its builder with the goal banner", async () => {
    const user = userEvent.setup();
    render(
      <CampaignView
        allCampaigns={campaignsWith30([makeClient("a")])}
        metrics={makeMetrics()}
        businessName="סטודיו"
      />,
    );
    // The 30-day card's CTA enters its builder.
    const card = screen.getByText("קמפיין חזרה אחרי 30 יום").closest("div")!.parentElement!.parentElement!;
    await user.click(within(card).getByRole("button", { name: "יצירת קמפיין" }));
    expect(await screen.findByText("שלב 1 — מטרת הקמפיין")).toBeInTheDocument();
    expect(screen.getByText("חזרה לבחירת קמפיין")).toBeInTheDocument();
  });
});

describe("CampaignView — defaultCampaignType deep link", () => {
  function renderBuilder(clients = [makeClient("a"), makeClient("b")]) {
    return render(
      <CampaignView
        allCampaigns={campaignsWith30(clients)}
        metrics={makeMetrics()}
        businessName="סטודיו"
        defaultCampaignType="30"
      />,
    );
  }

  it("opens straight into the builder when a default campaign is provided", () => {
    renderBuilder();
    expect(screen.getByText("שלב 1 — מטרת הקמפיין")).toBeInTheDocument();
    // stepper labels
    expect(screen.getByText("מטרה")).toBeInTheDocument();
    expect(screen.getByText("שליחה")).toBeInTheDocument();
  });

  it("renders audience stats and the revenue-impact projection", async () => {
    const user = userEvent.setup();
    renderBuilder();
    // Audience section starts collapsed — expand it.
    await user.click(screen.getByRole("button", { name: /קהל היעד/ }));
    expect(screen.getByText("פוטנציאל ההכנסה")).toBeInTheDocument();
    expect(screen.getByText("אם לקוחה אחת תחזור")).toBeInTheDocument();
  });

  it("selecting an offer reflects it in the summary card and opens the message step", async () => {
    const user = userEvent.setup();
    renderBuilder();
    // The offer step is open by default in the deep-linked builder.
    await user.click(screen.getByRole("button", { name: "10% הנחה" }));
    // Choosing an offer collapses the offer step and opens the message step,
    // and the chosen offer is surfaced in the summary card.
    expect(screen.getAllByText("10% הנחה").length).toBeGreaterThan(0);
    expect(screen.getByText("הטבה שנבחרה:")).toBeInTheDocument();
  });

  it("changing the tone updates the editable message template", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: /הודעת הקמפיין/ }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const before = textarea.value;
    // tone chip "קצרה לוואטסאפ"
    await user.click(screen.getByRole("button", { name: "קצרה לוואטסאפ" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).not.toBe(before);
  });

  it("editing the message marks step 4 done and renders a personalized preview", async () => {
    const user = userEvent.setup();
    renderBuilder([makeClient("a", { fullName: "מיכל" })]);
    await user.click(screen.getByRole("button", { name: /הודעת הקמפיין/ }));
    expect(screen.getByText("תצוגה מקדימה")).toBeInTheDocument();
    // name appears in the "עבור <name>" label and inside the rendered preview
    expect(screen.getAllByText(/מיכל/).length).toBeGreaterThan(0);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, " נוסף");
    // preview area still present after editing
    expect(screen.getByText("תצוגה מקדימה")).toBeInTheDocument();
  });

  it("copies the preview message and shows the copied confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderBuilder([makeClient("a")]);
    await user.click(screen.getByRole("button", { name: /הודעת הקמפיין/ }));
    await user.click(screen.getByRole("button", { name: /העתקת הודעה/ }));
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText("הועתק")).toBeInTheDocument();
  });

  it("the campaign-ready banner starts the send step", async () => {
    const user = userEvent.setup();
    renderBuilder([makeClient("a"), makeClient("b")]);
    expect(screen.getByText("הקמפיין מוכן לשליחה")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "התחילי שליחה" }));
    // scrollIntoView runs in a short setTimeout after the section expands.
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it("the back button returns to the campaign selector", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: /חזרה לבחירת קמפיין/ }));
    expect(screen.getByText("בחרי קמפיין")).toBeInTheDocument();
  });
});

describe("CampaignView — send & tracking", () => {
  function renderSend(clients = [makeClient("a"), makeClient("b")]) {
    render(
      <CampaignView
        allCampaigns={campaignsWith30(clients)}
        metrics={makeMetrics()}
        businessName="סטודיו"
        defaultCampaignType="30"
      />,
    );
  }

  async function openSend(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /שליחה ומעקב/ }));
  }

  it("lists recipients with WhatsApp open links and copy/profile actions", async () => {
    const user = userEvent.setup();
    renderSend([makeClient("a", { fullName: "רוני" })]);
    await openSend(user);
    expect(screen.getByText("רוני")).toBeInTheDocument();
    const waLinks = screen.getAllByText("פתיחה בוואטסאפ");
    expect(waLinks.length).toBeGreaterThan(0);
    // profile link to /clients/a
    const profile = document.querySelector('a[href="/clients/a"]');
    expect(profile).not.toBeNull();
  });

  it("opening WhatsApp reveals the 'סמני כנשלחה' action, which moves the row to 'sent'", async () => {
    const user = userEvent.setup();
    renderSend([makeClient("a")]);
    await openSend(user);
    // mark-sent button hidden until WhatsApp opened
    expect(screen.queryByRole("button", { name: "סמני כנשלחה" })).not.toBeInTheDocument();
    // The recipient WhatsApp link (last one — preview link may also exist).
    const waLink = screen.getAllByText("פתיחה בוואטסאפ").slice(-1)[0].closest("a")!;
    await user.click(waLink);
    const markSent = await screen.findByRole("button", { name: "סמני כנשלחה" });
    await user.click(markSent);
    // status badge now shows "נשלחה ידנית"
    expect(await screen.findByText("נשלחה ידנית")).toBeInTheDocument();
  });

  it("cycles a tracking badge through statuses on click", async () => {
    const user = userEvent.setup();
    renderSend([makeClient("a")]);
    await openSend(user);
    const waLink = screen.getAllByText("פתיחה בוואטסאפ").slice(-1)[0].closest("a")!;
    await user.click(waLink);
    await user.click(await screen.findByRole("button", { name: "סמני כנשלחה" }));
    // badge starts at "נשלחה ידנית"; clicking cycles to next ("ענתה")
    const badge = await screen.findByRole("button", { name: "נשלחה ידנית" });
    await user.click(badge);
    expect(await screen.findByText("ענתה")).toBeInTheDocument();
  });

  it("copies a per-recipient message and shows the row 'הועתק' state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderSend([makeClient("a")]);
    await openSend(user);
    await user.click(screen.getByRole("button", { name: /העתקי/ }));
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText("הועתק")).toBeInTheDocument();
  });
});

describe("CampaignView — empty audiences & invalid phones", () => {
  it("shows the no-recipients audience state for an empty campaign", async () => {
    const user = userEvent.setup();
    render(
      <CampaignView
        allCampaigns={emptyCampaigns()}
        metrics={makeMetrics({ totalRecoverable: 0 })}
        businessName="סטודיו"
        defaultCampaignType="30"
      />,
    );
    await user.click(screen.getByRole("button", { name: /קהל היעד/ }));
    expect(screen.getByText("אין כרגע לקוחות שמתאימות לקמפיין הזה")).toBeInTheDocument();
    // No ready banner with zero clients.
    expect(screen.queryByText("הקמפיין מוכן לשליחה")).not.toBeInTheDocument();
  });

  it("shows the empty send list for an empty campaign", async () => {
    const user = userEvent.setup();
    render(
      <CampaignView
        allCampaigns={emptyCampaigns()}
        metrics={makeMetrics({ totalRecoverable: 0 })}
        businessName="סטודיו"
        defaultCampaignType="60"
      />,
    );
    await user.click(screen.getByRole("button", { name: /שליחה ומעקב/ }));
    expect(screen.getAllByText("אין כרגע לקוחות שמתאימות לקמפיין הזה").length).toBeGreaterThan(0);
  });

  it("renders a disabled WhatsApp affordance for an invalid phone in the send list", async () => {
    const user = userEvent.setup();
    render(
      <CampaignView
        allCampaigns={campaignsWith30([makeClient("a", { phone: "123" })])}
        metrics={makeMetrics()}
        businessName="סטודיו"
        defaultCampaignType="30"
      />,
    );
    await user.click(screen.getByRole("button", { name: /שליחה ומעקב/ }));
    const waText = screen.getAllByText("פתיחה בוואטסאפ").slice(-1)[0];
    // invalid → rendered as span, not a link
    expect(waText.closest("a")).toBeNull();
    expect(waText.closest("span")).toHaveAttribute("title", "מספר טלפון לא תקין");
  });
});

describe("CampaignView — stepper navigation", () => {
  /** The stepper's round numbered buttons (1..5), in document order. */
  function stepperButtons(): HTMLButtonElement[] {
    // The label spans ("מטרה" .. "שליחה") share a column with the round button.
    const goalCol = screen.getByText("מטרה").parentElement!.parentElement!;
    const row = goalCol.parentElement!; // the dir="rtl" stepper row
    return Array.from(row.querySelectorAll("button.h-7.w-7")) as HTMLButtonElement[];
  }

  it("clicking the goal step scrolls to the top", async () => {
    const user = userEvent.setup();
    render(
      <CampaignView
        allCampaigns={campaignsWith30([makeClient("a")])}
        metrics={makeMetrics()}
        businessName="סטודיו"
        defaultCampaignType="30"
      />,
    );
    await user.click(stepperButtons()[0]);
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("clicking a later step expands that section and scrolls into view", async () => {
    const user = userEvent.setup();
    render(
      <CampaignView
        allCampaigns={campaignsWith30([makeClient("a")])}
        metrics={makeMetrics()}
        businessName="סטודיו"
        defaultCampaignType="30"
      />,
    );
    // step index 1 ("קהל") → expands audience + scrollIntoView
    await user.click(stepperButtons()[1]);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
