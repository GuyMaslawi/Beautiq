// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ updateClientOptInAction: vi.fn() }));
vi.mock("@/server/clients/actions", () => ({
  updateClientOptInAction: m.updateClientOptInAction,
}));

import { ClientOptInForm } from "@/components/clients/client-opt-in-form";
import { CLIENTS } from "@/lib/constants/he";

const c = CLIENTS.detail;

beforeEach(() => {
  vi.clearAllMocks();
  // The real action signature is (clientId, prevState, formData) — the
  // component binds clientId, so the mock is the raw action returning state.
  m.updateClientOptInAction.mockResolvedValue({});
});

describe("ClientOptInForm", () => {
  it("renders the section header, helper, both checkboxes and save button", () => {
    render(<ClientOptInForm clientId="c1" whatsappOptIn={false} marketingOptIn={false} />);

    expect(screen.getByText(c.optInSection)).toBeInTheDocument();
    expect(screen.getByText(c.optInHelper)).toBeInTheDocument();
    expect(screen.getByText(c.whatsappOptInLabel)).toBeInTheDocument();
    expect(screen.getByText(c.marketingOptInLabel)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.optInSave })).toBeInTheDocument();
  });

  it("reflects the initial checked state from props", () => {
    render(<ClientOptInForm clientId="c1" whatsappOptIn={true} marketingOptIn={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("toggles a checkbox via local state", async () => {
    render(<ClientOptInForm clientId="c1" whatsappOptIn={false} marketingOptIn={false} />);
    const [whatsapp] = screen.getAllByRole("checkbox");
    expect(whatsapp).not.toBeChecked();
    await userEvent.click(whatsapp);
    expect(whatsapp).toBeChecked();
  });

  it("submits the form, calling the action with the bound clientId", async () => {
    m.updateClientOptInAction.mockResolvedValue({ success: true });
    render(<ClientOptInForm clientId="abc" whatsappOptIn={false} marketingOptIn={false} />);

    await userEvent.click(screen.getByRole("button", { name: c.optInSave }));
    await waitFor(() => expect(m.updateClientOptInAction).toHaveBeenCalled());
    // First bound arg is the clientId.
    expect(m.updateClientOptInAction.mock.calls[0][0]).toBe("abc");
  });

  it("shows the success confirmation when the action returns success", async () => {
    m.updateClientOptInAction.mockResolvedValue({ success: true });
    render(<ClientOptInForm clientId="c1" whatsappOptIn={false} marketingOptIn={false} />);

    await userEvent.click(screen.getByRole("button", { name: c.optInSave }));
    expect(await screen.findByText(`✓ ${c.optInSaved}`)).toBeInTheDocument();
  });

  it("shows an error message when the action returns an error", async () => {
    m.updateClientOptInAction.mockResolvedValue({ error: "שמירה נכשלה" });
    render(<ClientOptInForm clientId="c1" whatsappOptIn={false} marketingOptIn={false} />);

    await userEvent.click(screen.getByRole("button", { name: c.optInSave }));
    expect(await screen.findByText("שמירה נכשלה")).toBeInTheDocument();
  });

  it("re-syncs local checkbox state when the props change on a re-render", () => {
    const { rerender } = render(
      <ClientOptInForm clientId="c1" whatsappOptIn={false} marketingOptIn={false} />,
    );
    expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked();

    rerender(<ClientOptInForm clientId="c1" whatsappOptIn={true} marketingOptIn={true} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });
});
