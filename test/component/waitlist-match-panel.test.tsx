// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WaitlistMatchPanel } from "@/components/waitlist/waitlist-match-panel";
import type { WaitlistCandidate } from "@/server/waitlist/queries";

const writeText = vi.fn(() => Promise.resolve());
function makeUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function candidate(over: Partial<WaitlistCandidate> = {}): WaitlistCandidate {
  return {
    id: "w1",
    clientId: "c1",
    clientName: "עדי כהן",
    clientPhone: "0501234567",
    serviceId: "s1",
    serviceName: "לק ג׳ל",
    preferredFrom: null,
    preferredTo: null,
    notes: null,
    status: "active",
    createdAt: new Date(),
    isStrongMatch: false,
    ...over,
  };
}

describe("WaitlistMatchPanel", () => {
  it("renders nothing when there are no candidates", () => {
    const { container } = render(
      <WaitlistMatchPanel candidates={[]} bookingDate="20 ביוני" bookingTime="14:00" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a singular title for one candidate", () => {
    render(
      <WaitlistMatchPanel
        candidates={[candidate()]}
        bookingDate="20 ביוני"
        bookingTime="14:00"
      />,
    );
    expect(screen.getByText("לקוחה אחת ממתינה לתור זה")).toBeInTheDocument();
  });

  it("renders a plural title for multiple candidates", () => {
    render(
      <WaitlistMatchPanel
        candidates={[candidate(), candidate({ id: "w2", clientName: "דנה" })]}
        bookingDate="20 ביוני"
        bookingTime="14:00"
      />,
    );
    expect(screen.getByText("2 לקוחות ממתינות לתור זה")).toBeInTheDocument();
  });

  it("expands candidates and shows the prebuilt editable message", async () => {
    const user = makeUser();
    render(
      <WaitlistMatchPanel
        candidates={[candidate({ isStrongMatch: true })]}
        bookingDate="20 ביוני"
        bookingTime="14:00"
      />,
    );
    await user.click(screen.getByRole("button", { name: /צפייה בלקוחות הממתינות/ }));
    expect(screen.getByText("התאמה מלאה")).toBeInTheDocument();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("היי עדי כהן, התפנה אצלנו תור ללק ג׳ל");
    expect(textarea.value).toContain("בתאריך 20 ביוני בשעה 14:00");
  });

  it("builds a wa.me link reflecting edits and copies the message", async () => {
    const user = makeUser();
    render(
      <WaitlistMatchPanel
        candidates={[candidate()]}
        bookingDate="20 ביוני"
        bookingTime="14:00"
      />,
    );
    await user.click(screen.getByRole("button", { name: /צפייה בלקוחות הממתינות/ }));
    const link = screen.getByRole("link", { name: /שלחי הודעה/ });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\+?972501234567\?text=/);

    await user.click(screen.getByRole("button", { name: /העתקת ההודעה/ }));
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText("הועתק!")).toBeInTheDocument();
  });

  it("collapses again when toggled off", async () => {
    const user = makeUser();
    render(
      <WaitlistMatchPanel
        candidates={[candidate()]}
        bookingDate="20 ביוני"
        bookingTime="14:00"
      />,
    );
    await user.click(screen.getByRole("button", { name: /צפייה בלקוחות הממתינות/ }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /הסתרה/ }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
