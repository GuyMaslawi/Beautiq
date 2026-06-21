// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptySlotsSection } from "@/components/dashboard/empty-slots-section";
import type { EmptySlot } from "@/lib/empty-slots/find-empty-slots";
import type { SuggestedClient } from "@/server/empty-slots/queries";

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

const slot: EmptySlot = {
  date: "2026-06-22",
  weekday: 1,
  startMinutes: 600, // 10:00
  endMinutes: 690, // 11:30
  durationMinutes: 90,
};

const clients: SuggestedClient[] = [
  { id: "c1", fullName: "דנה לוי", phone: "0501234567", lastVisitAtISO: null },
];

describe("dashboard EmptySlotsSection", () => {
  it("renders nothing when services/availability are not set up", () => {
    const { container } = render(
      <EmptySlotsSection slots={[slot]} suggestedClients={clients} hasServicesAndAvailability={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the no-slots state", () => {
    render(
      <EmptySlotsSection slots={[]} suggestedClients={clients} hasServicesAndAvailability />,
    );
    expect(screen.getByText("אין חלונות פנויים משמעותיים בימים הקרובים")).toBeInTheDocument();
  });

  it("renders a slot card with the free-window duration label", () => {
    render(
      <EmptySlotsSection slots={[slot]} suggestedClients={clients} hasServicesAndAvailability />,
    );
    expect(screen.getByText("10:00–11:30")).toBeInTheDocument();
    // freeWindow · "שעה וחצי" (90 minutes)
    expect(screen.getByText(/חלון פנוי · שעה וחצי/)).toBeInTheDocument();
  });

  it("expands the message panel, builds a generic message and copies it", async () => {
    const user = makeUser();
    render(
      <EmptySlotsSection slots={[slot]} suggestedClients={[]} hasServicesAndAvailability />,
    );
    await user.click(screen.getByRole("button", { name: /הכנת הודעה/ }));
    // No suggested clients → fallback note + generic message body
    expect(
      screen.getByText("אין כרגע לקוחות מתאימות להצעה, אבל אפשר לשלוח הודעה ידנית."),
    ).toBeInTheDocument();
    expect(screen.getByText(/היי, התפנה תור/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /העתקת הודעה/ }));
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText(/✓/)).toBeInTheDocument();
  });

  it("personalises the message when a suggested client is selected", async () => {
    const user = makeUser();
    render(
      <EmptySlotsSection slots={[slot]} suggestedClients={clients} hasServicesAndAvailability />,
    );
    await user.click(screen.getByRole("button", { name: /הכנת הודעה/ }));
    await user.click(screen.getByRole("button", { name: /דנה לוי/ }));
    expect(screen.getByText(/היי דנה לוי, התפנה לי תור/)).toBeInTheDocument();
  });

  it("returns to the generic message via the generic option", async () => {
    const user = makeUser();
    render(
      <EmptySlotsSection slots={[slot]} suggestedClients={clients} hasServicesAndAvailability />,
    );
    await user.click(screen.getByRole("button", { name: /הכנת הודעה/ }));
    await user.click(screen.getByRole("button", { name: /דנה לוי/ }));
    await user.click(screen.getByRole("button", { name: "הודעה כללית" }));
    expect(screen.getByText(/היי, התפנה תור/)).toBeInTheDocument();
  });
});
