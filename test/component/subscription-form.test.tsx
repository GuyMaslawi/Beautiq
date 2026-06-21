// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { updateSub } = vi.hoisted(() => ({ updateSub: vi.fn() }));
vi.mock("@/server/admin/actions", () => ({
  updateBusinessSubscription: updateSub,
}));

import { SubscriptionForm } from "@/app/admin/businesses/[businessId]/_components/subscription-form";

beforeEach(() => {
  vi.clearAllMocks();
  updateSub.mockReset();
});

describe("SubscriptionForm", () => {
  it("seeds defaults when no subscription exists (basic, trial, 149)", () => {
    render(<SubscriptionForm businessId="b1" subscription={null} />);
    expect(screen.getByDisplayValue("בסיס — ₪149/חודש")).toBeInTheDocument();
    expect(screen.getByDisplayValue("בתקופת ניסיון")).toBeInTheDocument();
    expect(screen.getByDisplayValue("149")).toBeInTheDocument();
    // No discount → discount value field is hidden.
    expect(screen.queryByText(/סכום הנחה|אחוז הנחה/)).not.toBeInTheDocument();
  });

  it("reveals the discount value + note fields when a discount type is chosen", async () => {
    render(<SubscriptionForm businessId="b1" subscription={null} />);
    await userEvent.selectOptions(
      screen.getByDisplayValue("ללא הנחה"),
      "percentage",
    );
    expect(screen.getByText("אחוז הנחה (%)")).toBeInTheDocument();
    expect(screen.getByText("הערת הנחה (פנימית)")).toBeInTheDocument();
  });

  it("submits the form values to the action and shows the success message", async () => {
    updateSub.mockResolvedValue({ success: true });
    render(<SubscriptionForm businessId="b1" subscription={null} />);
    await userEvent.click(screen.getByRole("button", { name: "שמור שינויים" }));

    expect(updateSub).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ plan: "basic", status: "trial", monthlyPrice: "149" }),
    );
    expect(await screen.findByText(/השינויים נשמרו בהצלחה/)).toBeInTheDocument();
  });

  it("shows the server error on failure", async () => {
    updateSub.mockResolvedValue({ success: false, error: "מחיר לא תקין" });
    render(<SubscriptionForm businessId="b1" subscription={null} />);
    await userEvent.click(screen.getByRole("button", { name: "שמור שינויים" }));
    expect(await screen.findByText("מחיר לא תקין")).toBeInTheDocument();
  });

  it("hydrates from an existing subscription including discount fields", () => {
    render(
      <SubscriptionForm
        businessId="b1"
        subscription={{
          plan: "pro",
          status: "discounted",
          monthlyPrice: 199,
          discountType: "fixed",
          discountValue: 50,
          discountNote: "הנחת השקה",
          trialStartedAt: "2026-01-01T00:00:00.000Z",
          trialEndsAt: "2026-02-01T00:00:00.000Z",
          adminNotes: "VIP",
        }}
      />,
    );
    expect(screen.getByDisplayValue("פרו — ₪199/חודש")).toBeInTheDocument();
    expect(screen.getByDisplayValue("199")).toBeInTheDocument();
    expect(screen.getByDisplayValue("50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("הנחת השקה")).toBeInTheDocument();
    expect(screen.getByDisplayValue("VIP")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-01-01")).toBeInTheDocument();
  });
});
