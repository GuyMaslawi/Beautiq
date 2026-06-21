// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ updateClientAction: vi.fn() }));
vi.mock("@/server/clients/actions", () => ({
  updateClientAction: m.updateClientAction,
}));

import { ClientEditModal } from "@/components/clients/client-edit-modal";
import type { ClientEditInitialData } from "@/components/clients/client-edit-modal";
import { CLIENTS } from "@/lib/constants/he";

const c = CLIENTS.edit;

function makeData(overrides: Partial<ClientEditInitialData> = {}): ClientEditInitialData {
  return {
    fullName: "נועה כהן",
    phone: "0501234567",
    email: "noa@example.com",
    notes: "אלרגיה",
    whatsappOptIn: true,
    marketingOptIn: false,
    isUnsubscribed: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Action signature is (clientId, prevState, formData); the component binds
  // clientId, so the mock is the raw action returning the next state.
  m.updateClientAction.mockResolvedValue({});
});

describe("ClientEditModal", () => {
  it("renders only the open button initially (modal closed)", () => {
    render(<ClientEditModal clientId="c1" initialData={makeData()} />);
    expect(screen.getByRole("button", { name: c.openButton })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: c.title })).not.toBeInTheDocument();
  });

  it("opens the modal with the form fields pre-filled", async () => {
    render(<ClientEditModal clientId="c1" initialData={makeData()} />);
    await userEvent.click(screen.getByRole("button", { name: c.openButton }));

    expect(screen.getByRole("heading", { name: c.title })).toBeInTheDocument();
    expect(screen.getByDisplayValue("נועה כהן")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0501234567")).toBeInTheDocument();
    expect(screen.getByDisplayValue("noa@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("אלרגיה")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked(); // whatsappOptIn = true
    expect(checkboxes[1]).not.toBeChecked(); // marketingOptIn = false
  });

  it("handles null email and notes with empty defaults", async () => {
    render(
      <ClientEditModal
        clientId="c1"
        initialData={makeData({ email: null, notes: null })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    const email = screen.getByPlaceholderText(c.fields.emailPlaceholder);
    expect(email).toHaveValue("");
  });

  it("closes the modal via the cancel button", async () => {
    render(<ClientEditModal clientId="c1" initialData={makeData()} />);
    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    expect(screen.getByRole("heading", { name: c.title })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: c.cancelButton }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: c.title })).not.toBeInTheDocument());
  });

  it("closes the modal via the X close button", async () => {
    const { container } = render(<ClientEditModal clientId="c1" initialData={makeData()} />);
    await userEvent.click(screen.getByRole("button", { name: c.openButton }));

    // The X button is the icon-only button in the header (no accessible name).
    const headerClose = container.querySelector(".rounded-full");
    await userEvent.click(headerClose as Element);
    await waitFor(() => expect(screen.queryByRole("heading", { name: c.title })).not.toBeInTheDocument());
  });

  it("closes the modal when the backdrop is clicked", async () => {
    const { container } = render(<ClientEditModal clientId="c1" initialData={makeData()} />);
    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    const backdrop = container.querySelector(".bg-black\\/40");
    await userEvent.click(backdrop as Element);
    await waitFor(() => expect(screen.queryByRole("heading", { name: c.title })).not.toBeInTheDocument());
  });

  it("submits the form, calling the action with the bound clientId", async () => {
    m.updateClientAction.mockResolvedValue({});
    render(<ClientEditModal clientId="zzz" initialData={makeData()} />);

    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    await userEvent.click(screen.getByRole("button", { name: c.saveButton }));
    await waitFor(() => expect(m.updateClientAction).toHaveBeenCalled());
    // First bound arg is the clientId.
    expect(m.updateClientAction.mock.calls[0][0]).toBe("zzz");
  });

  it("auto-closes after a successful save", async () => {
    m.updateClientAction.mockResolvedValue({ success: true });
    render(<ClientEditModal clientId="c1" initialData={makeData()} />);

    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    await userEvent.click(screen.getByRole("button", { name: c.saveButton }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: c.title })).not.toBeInTheDocument());
  });

  it("renders field errors returned by the action", async () => {
    m.updateClientAction.mockResolvedValue({
      fieldErrors: { fullName: "יש למלא שם", phone: "טלפון לא תקין" },
    });
    render(<ClientEditModal clientId="c1" initialData={makeData()} />);

    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    await userEvent.click(screen.getByRole("button", { name: c.saveButton }));

    expect(await screen.findByText("יש למלא שם")).toBeInTheDocument();
    expect(screen.getByText("טלפון לא תקין")).toBeInTheDocument();
  });

  it("renders a form error returned by the action", async () => {
    m.updateClientAction.mockResolvedValue({ formError: "שמירה נכשלה" });
    render(<ClientEditModal clientId="c1" initialData={makeData()} />);

    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    await userEvent.click(screen.getByRole("button", { name: c.saveButton }));
    expect(await screen.findByText("שמירה נכשלה")).toBeInTheDocument();
  });

  it("shows the unsubscribe notice when the client opted out", async () => {
    render(
      <ClientEditModal clientId="c1" initialData={makeData({ isUnsubscribed: true })} />,
    );
    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    expect(screen.getByText(c.fields.unsubscribedNotice)).toBeInTheDocument();
  });

  it("does not show the unsubscribe notice when not unsubscribed", async () => {
    render(<ClientEditModal clientId="c1" initialData={makeData({ isUnsubscribed: false })} />);
    await userEvent.click(screen.getByRole("button", { name: c.openButton }));
    expect(screen.queryByText(c.fields.unsubscribedNotice)).not.toBeInTheDocument();
  });
});
