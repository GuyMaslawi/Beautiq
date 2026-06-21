// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push, refresh: m.refresh }),
}));

const { deleteAction } = vi.hoisted(() => ({ deleteAction: vi.fn() }));
vi.mock("@/server/admin/business-actions", () => ({
  adminDeleteBusinessAction: deleteAction,
}));

import { BusinessDangerZone } from "@/app/admin/businesses/[businessId]/_components/business-danger-zone";

const SUMMARY = {
  id: "b1",
  name: "סטודיו יופי",
  slug: "studio-yofi",
  ownerName: "עדי",
  ownerEmail: "owner@example.com",
  clientCount: 5,
  bookingCount: 12,
  serviceCount: 3,
  automationMessageCount: 7,
};

function renderZone(props: Partial<Parameters<typeof BusinessDangerZone>[0]> = {}) {
  return render(
    <BusinessDangerZone
      summary={SUMMARY}
      ownerDeletable
      ownerBlockReason={null}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteAction.mockReset();
});

describe("BusinessDangerZone", () => {
  it("renders both delete triggers", () => {
    renderZone();
    expect(screen.getByRole("button", { name: "מחיקת עסק" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "מחיקת משתמש ועסק" }),
    ).toBeInTheDocument();
  });

  it("disables the owner-delete button and shows the reason when not deletable", () => {
    renderZone({ ownerDeletable: false, ownerBlockReason: "לבעלים יש עסק נוסף" });
    expect(screen.getByRole("button", { name: "מחיקת משתמש ועסק" })).toBeDisabled();
    expect(screen.getByText("לבעלים יש עסק נוסף")).toBeInTheDocument();
  });

  it("opens the modal and keeps the confirm button disabled until the name matches", async () => {
    renderZone();
    await userEvent.click(screen.getByRole("button", { name: "מחיקת עסק" }));
    const dialog = screen.getByText("מחיקת עסק וכל המידע שלו").closest("div")!;
    // Confirm button (red, says מחיקת עסק) is disabled initially.
    const confirm = within(document.body).getAllByRole("button", { name: "מחיקת עסק" });
    // The modal's confirm is the last one rendered.
    expect(confirm[confirm.length - 1]).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText("סטודיו יופי"),
      "סטודיו יופי",
    );
    expect(confirm[confirm.length - 1]).toBeEnabled();
    expect(dialog).toBeTruthy();
  });

  it("accepts the slug as a valid confirmation and calls the action, then navigates", async () => {
    deleteAction.mockResolvedValue({ success: true });
    renderZone();
    await userEvent.click(screen.getByRole("button", { name: "מחיקת עסק" }));
    await userEvent.type(screen.getByPlaceholderText("סטודיו יופי"), "studio-yofi");

    const confirms = screen.getAllByRole("button", { name: "מחיקת עסק" });
    await userEvent.click(confirms[confirms.length - 1]);

    expect(deleteAction).toHaveBeenCalledWith("b1", "studio-yofi", false);
    await vi.waitFor(() => expect(m.push).toHaveBeenCalledWith("/admin/businesses"));
    expect(m.refresh).toHaveBeenCalled();
  });

  it("passes deleteOwnerUser=true when opening the user+business variant", async () => {
    deleteAction.mockResolvedValue({ success: true });
    renderZone();
    await userEvent.click(screen.getByRole("button", { name: "מחיקת משתמש ועסק" }));
    // The warning about deleting the owner account is shown.
    expect(screen.getByText(/תמחק גם את חשבון המשתמש/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("סטודיו יופי"), "סטודיו יופי");
    const confirms = screen.getAllByRole("button", { name: "מחיקת משתמש ועסק" });
    await userEvent.click(confirms[confirms.length - 1]);
    expect(deleteAction).toHaveBeenCalledWith("b1", "סטודיו יופי", true);
  });

  it("shows the server error and does not navigate on failure", async () => {
    deleteAction.mockResolvedValue({ error: "לא ניתן למחוק" });
    renderZone();
    await userEvent.click(screen.getByRole("button", { name: "מחיקת עסק" }));
    await userEvent.type(screen.getByPlaceholderText("סטודיו יופי"), "studio-yofi");
    const confirms = screen.getAllByRole("button", { name: "מחיקת עסק" });
    await userEvent.click(confirms[confirms.length - 1]);
    expect(await screen.findByText("לא ניתן למחוק")).toBeInTheDocument();
    expect(m.push).not.toHaveBeenCalled();
  });

  it("closes the modal via the cancel button", async () => {
    renderZone();
    await userEvent.click(screen.getByRole("button", { name: "מחיקת עסק" }));
    expect(screen.getByText("מחיקת עסק וכל המידע שלו")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ביטול" }));
    expect(screen.queryByText("מחיקת עסק וכל המידע שלו")).not.toBeInTheDocument();
  });
});
