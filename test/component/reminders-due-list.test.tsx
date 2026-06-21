// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemindersDueList } from "@/components/automations/reminders-due-list";
import { AUTOMATIONS } from "@/lib/constants/he";
import type { ReminderDueItem } from "@/server/automations/queries";

const m = vi.hoisted(() => ({
  markSent: vi.fn(() => Promise.resolve({})),
  markPending: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/server/automations/actions", () => ({
  markReminderSentAction: m.markSent,
  markReminderPendingAction: m.markPending,
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

const c = AUTOMATIONS.reminders.dueList;

function makeItem(over: Partial<ReminderDueItem> = {}): ReminderDueItem {
  return {
    bookingId: "bk-1",
    reminderId: "r-1",
    clientName: "דנה כהן",
    serviceName: "מניקור",
    phone: "0501234567",
    message: "היי דנה, יש לך תור מחר",
    startTimeISO: "2026-06-22T11:00:00.000Z",
    reminderStatus: "pending",
    ...over,
  } as ReminderDueItem;
}

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
});

describe("RemindersDueList — empty state", () => {
  it("renders the empty state when there are no reminders", () => {
    render(<RemindersDueList remindersDue={[]} reminderHours={24} />);
    expect(screen.getByText(c.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(c.emptyBody)).toBeInTheDocument();
  });
});

describe("RemindersDueList — reminder cards", () => {
  it("renders client, service, message and the reminder-in pill", () => {
    render(<RemindersDueList remindersDue={[makeItem()]} reminderHours={24} />);
    expect(screen.getByText("דנה כהן")).toBeInTheDocument();
    expect(screen.getByText("מניקור")).toBeInTheDocument();
    expect(screen.getByText("היי דנה, יש לך תור מחר")).toBeInTheDocument();
    expect(screen.getByText(c.reminderIn(24))).toBeInTheDocument();
  });

  it("shows the pending status badge", () => {
    render(<RemindersDueList remindersDue={[makeItem({ reminderStatus: "pending" })]} reminderHours={24} />);
    expect(screen.getByText(c.status.pending)).toBeInTheDocument();
  });

  it("renders a working WhatsApp link for a valid phone", () => {
    render(<RemindersDueList remindersDue={[makeItem()]} reminderHours={24} />);
    const wa = screen.getByRole("link", { name: c.actionWhatsApp });
    expect(wa).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });

  it("renders a disabled WhatsApp button when the phone is invalid", () => {
    render(<RemindersDueList remindersDue={[makeItem({ phone: "" })]} reminderHours={24} />);
    expect(screen.queryByRole("link", { name: c.actionWhatsApp })).not.toBeInTheDocument();
    expect(screen.getByText(c.actionWhatsApp)).toBeInTheDocument();
  });

  it("copies the message and flips the copy label", async () => {
    const user = userEvent.setup();
    // Re-assert our clipboard stub after userEvent.setup so it is the one used.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    render(<RemindersDueList remindersDue={[makeItem()]} reminderHours={24} />);
    await user.click(screen.getByRole("button", { name: c.actionCopy }));
    expect(writeText).toHaveBeenCalledWith("היי דנה, יש לך תור מחר");
    expect(await screen.findByText(c.messageCopied)).toBeInTheDocument();
  });

  it("marks a reminder as sent and switches to the 'mark pending' action", async () => {
    const user = userEvent.setup();
    render(<RemindersDueList remindersDue={[makeItem()]} reminderHours={24} />);
    await user.click(screen.getByRole("button", { name: c.actionMarkSent }));
    expect(m.markSent).toHaveBeenCalledWith("bk-1");
    expect(await screen.findByRole("button", { name: c.actionMarkPending })).toBeInTheDocument();
  });

  it("marks a sent reminder back to pending", async () => {
    const user = userEvent.setup();
    render(
      <RemindersDueList remindersDue={[makeItem({ reminderStatus: "sent" })]} reminderHours={24} />,
    );
    await user.click(screen.getByRole("button", { name: c.actionMarkPending }));
    expect(m.markPending).toHaveBeenCalledWith("r-1");
  });

  it("does not flip status when the mark-sent action returns an error", async () => {
    m.markSent.mockResolvedValueOnce({ error: "failed" });
    const user = userEvent.setup();
    render(<RemindersDueList remindersDue={[makeItem()]} reminderHours={24} />);
    await user.click(screen.getByRole("button", { name: c.actionMarkSent }));
    expect(m.markSent).toHaveBeenCalled();
    // Still pending — the mark-sent button remains.
    expect(await screen.findByRole("button", { name: c.actionMarkSent })).toBeInTheDocument();
  });

  it("hides actions for a cancelled reminder", () => {
    render(
      <RemindersDueList remindersDue={[makeItem({ reminderStatus: "cancelled" })]} reminderHours={24} />,
    );
    expect(screen.getByText(c.status.cancelled)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.actionCopy })).not.toBeInTheDocument();
  });

  it("links 'view booking' to the booking page", () => {
    render(<RemindersDueList remindersDue={[makeItem()]} reminderHours={24} />);
    expect(screen.getByText(c.actionViewBooking).closest("a")).toHaveAttribute(
      "href",
      "/bookings/bk-1",
    );
  });
});
