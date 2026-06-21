// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { deleteAction } = vi.hoisted(() => ({ deleteAction: vi.fn() }));
vi.mock("@/server/admin/client-actions", () => ({
  adminDeleteClientsAction: deleteAction,
}));

// Stub the child modals so the table test stays focused on selection + delete.
vi.mock("@/app/admin/clients/_components/admin-client-edit-modal", () => ({
  AdminClientEditModal: () => <button type="button">עריכה</button>,
}));
vi.mock("@/components/clients/whatsapp-manual-send-modal", () => ({
  WhatsAppManualSendModal: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

import { AdminClientsTable } from "@/app/admin/clients/_components/admin-clients-table";
import type { AdminClientListItem } from "@/server/admin/client-queries";

const CLIENTS: AdminClientListItem[] = [
  {
    id: "c1",
    fullName: "עדי לוי",
    phone: "0501111111",
    email: "adi@example.com",
    businessId: "b1",
    businessName: "סטודיו א",
    whatsappOptIn: true,
    marketingOptIn: false,
    notes: null,
    unsubscribedAt: null,
    lastBookingAt: new Date("2026-05-01"),
    createdAt: new Date("2026-01-01"),
  } as unknown as AdminClientListItem,
  {
    id: "c2",
    fullName: "נועה כהן",
    phone: "0502222222",
    email: null,
    businessId: "b2",
    businessName: "סטודיו ב",
    whatsappOptIn: false,
    marketingOptIn: true,
    notes: null,
    unsubscribedAt: new Date("2026-04-01"),
    lastBookingAt: null,
    createdAt: new Date("2026-02-01"),
  } as unknown as AdminClientListItem,
];

beforeEach(() => {
  vi.clearAllMocks();
  deleteAction.mockReset();
});

describe("AdminClientsTable", () => {
  it("renders all client rows and the count footer", () => {
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    expect(screen.getByText("עדי לוי")).toBeInTheDocument();
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText("מציג 2 לקוחות")).toBeInTheDocument();
    // unsubscribed badge for c2
    expect(screen.getByText("הסירה עצמה")).toBeInTheDocument();
  });

  it("shows the bulk action bar once a row is selected", async () => {
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    await userEvent.click(screen.getByLabelText("בחירת עדי לוי"));
    expect(screen.getByText("1 לקוחות נבחרו")).toBeInTheDocument();
  });

  it("select-all toggles every visible row and clearing resets the bar", async () => {
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    await userEvent.click(screen.getByLabelText("בחירת כל הלקוחות"));
    expect(screen.getByText("2 לקוחות נבחרו")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ניקוי בחירה" }));
    expect(screen.queryByText(/לקוחות נבחרו/)).not.toBeInTheDocument();
  });

  it("opens the single-row delete modal and gates confirm on the word מחיקה", async () => {
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    const rowDeletes = screen.getAllByRole("button", { name: "מחיקה" });
    await userEvent.click(rowDeletes[0]);

    expect(screen.getByText("מחיקת לקוחות")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "כן, למחוק" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("מחיקה"), "מחיקה");
    expect(confirm).toBeEnabled();
  });

  it("calls the delete action and shows the success banner", async () => {
    deleteAction.mockResolvedValue({ success: true, deletedCount: 1 });
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "מחיקה" })[0]);
    await userEvent.type(screen.getByPlaceholderText("מחיקה"), "מחיקה");
    await userEvent.click(screen.getByRole("button", { name: "כן, למחוק" }));

    expect(deleteAction).toHaveBeenCalledWith(["c1"]);
    expect(await screen.findByText("הלקוחה נמחקה בהצלחה")).toBeInTheDocument();
  });

  it("warns about multiple businesses when a multi-business bulk delete is staged", async () => {
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    await userEvent.click(screen.getByLabelText("בחירת כל הלקוחות"));
    await userEvent.click(
      screen.getByRole("button", { name: "מחיקת לקוחות נבחרים" }),
    );
    expect(screen.getByText(/שייכים למספר עסקים/)).toBeInTheDocument();
  });

  it("surfaces the server error from a failed delete", async () => {
    deleteAction.mockResolvedValue({ error: "מחיקה נכשלה" });
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "מחיקה" })[0]);
    await userEvent.type(screen.getByPlaceholderText("מחיקה"), "מחיקה");
    await userEvent.click(screen.getByRole("button", { name: "כן, למחוק" }));
    expect(await screen.findByText("מחיקה נכשלה")).toBeInTheDocument();
  });

  it("closes the confirm modal via cancel without calling the action", async () => {
    render(<AdminClientsTable clients={CLIENTS} isTestMode={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "מחיקה" })[0]);
    const dialog = screen.getByText("מחיקת לקוחות").closest("div")!;
    await userEvent.click(within(dialog.parentElement!).getByRole("button", { name: "ביטול" }));
    expect(screen.queryByText("מחיקת לקוחות")).not.toBeInTheDocument();
    expect(deleteAction).not.toHaveBeenCalled();
  });
});
