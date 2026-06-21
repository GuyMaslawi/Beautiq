// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { editAction } = vi.hoisted(() => ({
  editAction: { bind: vi.fn() },
}));
vi.mock("@/server/admin/client-actions", () => ({
  adminUpdateClientAction: editAction,
}));

import { AdminClientEditModal } from "@/app/admin/clients/_components/admin-client-edit-modal";

const INITIAL = {
  fullName: "עדי לוי",
  phone: "0501234567",
  email: "adi@example.com",
  notes: "לקוחה קבועה",
  whatsappOptIn: true,
  marketingOptIn: false,
  businessName: "סטודיו יופי",
};

beforeEach(() => {
  vi.clearAllMocks();
  editAction.bind.mockReturnValue(vi.fn(async () => ({})));
});

describe("AdminClientEditModal", () => {
  it("binds the action to the clientId", () => {
    render(<AdminClientEditModal clientId="c1" initialData={INITIAL} />);
    expect(editAction.bind).toHaveBeenCalledWith(null, "c1");
  });

  it("modal is closed initially; opens on the edit trigger", async () => {
    render(<AdminClientEditModal clientId="c1" initialData={INITIAL} />);
    expect(screen.queryByText("עריכת לקוחה")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "עריכה" }));
    expect(screen.getByText("עריכת לקוחה")).toBeInTheDocument();
    expect(screen.getByText("עסק: סטודיו יופי")).toBeInTheDocument();
  });

  it("seeds the form fields from initialData", async () => {
    render(<AdminClientEditModal clientId="c1" initialData={INITIAL} />);
    await userEvent.click(screen.getByRole("button", { name: "עריכה" }));
    expect(screen.getByDisplayValue("עדי לוי")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0501234567")).toBeInTheDocument();
    expect(screen.getByDisplayValue("adi@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("לקוחה קבועה")).toBeInTheDocument();
  });

  it("closes via the cancel button", async () => {
    render(<AdminClientEditModal clientId="c1" initialData={INITIAL} />);
    await userEvent.click(screen.getByRole("button", { name: "עריכה" }));
    await userEvent.click(screen.getByRole("button", { name: "ביטול" }));
    expect(screen.queryByText("עריכת לקוחה")).not.toBeInTheDocument();
  });

  it("renders field errors and a top-level form error from the action state", async () => {
    editAction.bind.mockReturnValue(
      vi.fn(async () => ({
        formError: "שגיאה כללית",
        fieldErrors: { fullName: "שם חסר", phone: "טלפון לא תקין" },
      })),
    );
    render(<AdminClientEditModal clientId="c1" initialData={INITIAL} />);
    await userEvent.click(screen.getByRole("button", { name: "עריכה" }));
    await userEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));
    expect(await screen.findByText("שגיאה כללית")).toBeInTheDocument();
    expect(screen.getByText("שם חסר")).toBeInTheDocument();
    expect(screen.getByText("טלפון לא תקין")).toBeInTheDocument();
  });

  it("auto-closes the modal when the action reports success", async () => {
    editAction.bind.mockReturnValue(vi.fn(async () => ({ success: true })));
    render(<AdminClientEditModal clientId="c1" initialData={INITIAL} />);
    await userEvent.click(screen.getByRole("button", { name: "עריכה" }));
    await userEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));
    await vi.waitFor(() =>
      expect(screen.queryByText("עריכת לקוחה")).not.toBeInTheDocument(),
    );
  });
});
