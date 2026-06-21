// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WaitlistFormState } from "@/server/waitlist/actions";

const m = vi.hoisted(() => ({ createWaitlistEntryAction: vi.fn() }));
vi.mock("@/server/waitlist/actions", () => ({
  createWaitlistEntryAction: m.createWaitlistEntryAction,
}));

import { WaitlistAddForm } from "@/components/waitlist/waitlist-add-form";

const services = [
  { id: "s1", name: "לק ג׳ל" },
  { id: "s2", name: "פדיקור" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WaitlistAddForm", () => {
  it("starts collapsed showing only the add button", () => {
    render(<WaitlistAddForm services={services} />);
    expect(screen.getByRole("button", { name: /הוספה לרשימה/ })).toBeInTheDocument();
    expect(screen.queryByText("הוספת לקוחה לרשימת ההמתנה")).not.toBeInTheDocument();
  });

  it("expands the form with all fields and service options", async () => {
    const user = userEvent.setup();
    render(<WaitlistAddForm services={services} />);
    await user.click(screen.getByRole("button", { name: /הוספה לרשימה/ }));
    expect(screen.getByText("הוספת לקוחה לרשימת ההמתנה")).toBeInTheDocument();
    expect(screen.getByLabelText("שם הלקוחה")).toBeInTheDocument();
    expect(screen.getByLabelText("טלפון")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "לק ג׳ל" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "פדיקור" })).toBeInTheDocument();
  });

  it("collapses again via the close button", async () => {
    const user = userEvent.setup();
    render(<WaitlistAddForm services={services} />);
    await user.click(screen.getByRole("button", { name: /הוספה לרשימה/ }));
    await user.click(screen.getByRole("button", { name: /סגירה/ }));
    expect(screen.queryByText("הוספת לקוחה לרשימת ההמתנה")).not.toBeInTheDocument();
  });

  it("submits the form data to the action", async () => {
    m.createWaitlistEntryAction.mockImplementation(
      async (_prev: WaitlistFormState, fd: FormData): Promise<WaitlistFormState> => {
        expect(fd.get("clientName")).toBe("עדי כהן");
        expect(fd.get("phone")).toBe("0501234567");
        return { success: true, nonce: "n1" };
      },
    );
    const user = userEvent.setup();
    render(<WaitlistAddForm services={services} />);
    await user.click(screen.getByRole("button", { name: /הוספה לרשימה/ }));
    await user.type(screen.getByLabelText("שם הלקוחה"), "עדי כהן");
    await user.type(screen.getByLabelText("טלפון"), "0501234567");
    await user.click(screen.getByRole("button", { name: /^הוספה לרשימה$/ }));
    expect(m.createWaitlistEntryAction).toHaveBeenCalled();
    // After success the form collapses and shows the confirmation.
    expect(await screen.findByText("הלקוחה נוספה לרשימת ההמתנה")).toBeInTheDocument();
  });

  it("shows field errors returned by the action", async () => {
    m.createWaitlistEntryAction.mockResolvedValue({
      errors: { clientName: "יש להזין שם", phone: "יש להזין מספר טלפון תקין" },
      values: {},
    } satisfies WaitlistFormState);
    const user = userEvent.setup();
    render(<WaitlistAddForm services={services} />);
    await user.click(screen.getByRole("button", { name: /הוספה לרשימה/ }));
    await user.click(screen.getByRole("button", { name: /^הוספה לרשימה$/ }));
    expect(await screen.findByText("יש להזין שם")).toBeInTheDocument();
    expect(screen.getByText("יש להזין מספר טלפון תקין")).toBeInTheDocument();
  });

  it("shows a top-level form error", async () => {
    m.createWaitlistEntryAction.mockResolvedValue({
      formError: "משהו השתבש. נסי שוב.",
    } satisfies WaitlistFormState);
    const user = userEvent.setup();
    render(<WaitlistAddForm services={services} />);
    await user.click(screen.getByRole("button", { name: /הוספה לרשימה/ }));
    await user.click(screen.getByRole("button", { name: /^הוספה לרשימה$/ }));
    expect(await screen.findByText("משהו השתבש. נסי שוב.")).toBeInTheDocument();
  });
});
