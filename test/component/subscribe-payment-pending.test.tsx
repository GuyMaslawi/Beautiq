// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIM = new Set(["initial", "animate", "exit", "transition"]);
  const strip = (props: Record<string, unknown>) => {
    const rest: Record<string, unknown> = {};
    for (const k in props) if (!ANIM.has(k)) rest[k] = props[k];
    return React.createElement("div", rest);
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: () => strip }),
  };
});

// מסך התשלום מושך את ה-server action ודרכו את next-auth, שאינו נטען בסביבת
// jsdom. הבדיקה כאן עוסקת רק במסך ההמתנה ובמסך ההפעלה, ולכן די בתחליף.
vi.mock("@/components/plans/plan-checkout", () => ({
  PlanCheckout: () => null,
}));

import { SubscribeClient } from "@/app/subscribe/subscribe-client";

/**
 * הגנה על תיקון של חיוב כפול: /api/subscription/return מפנה ל-/subscribe?pending=1
 * כשאישור התשלום מ-Grow עדיין לא נקלט. קודם הפרמטר הזה לא נקרא כלל, ובעלת העסק
 * ראתה שוב את מסך התשלום כאילו התשלום נעלם — ושילמה פעם שנייה.
 */
describe("SubscribeClient — payment pending", () => {
  beforeEach(() => m.refresh.mockClear());

  it("tells the owner the payment landed and not to pay again", () => {
    render(<SubscribeClient userName="גיא" paymentPending />);

    expect(screen.getByText(/קיבלנו את התשלום/)).toBeInTheDocument();
    expect(screen.getByText(/אין צורך לשלם שוב/)).toBeInTheDocument();
  });

  it("hides the checkout while pending, so there is nothing to pay for twice", () => {
    render(<SubscribeClient userName="גיא" paymentPending />);

    expect(screen.queryByText(/מנוי אחד. כל הכלים./)).not.toBeInTheDocument();
  });

  it("shows the checkout normally when not returning from payment", () => {
    render(<SubscribeClient userName="גיא" />);

    expect(screen.getByText(/מנוי אחד. כל הכלים./)).toBeInTheDocument();
    expect(screen.queryByText(/קיבלנו את התשלום/)).not.toBeInTheDocument();
  });

  it("re-checks the status on demand", async () => {
    render(<SubscribeClient userName="גיא" paymentPending />);

    await userEvent.click(screen.getByRole("button", { name: /בדיקת סטטוס/ }));
    expect(m.refresh).toHaveBeenCalled();
  });

  it("still offers a way back to checkout if the payment really failed", async () => {
    render(<SubscribeClient userName="גיא" paymentPending />);

    await userEvent.click(screen.getByRole("button", { name: /מעבר לתשלום מחדש/ }));
    expect(screen.getByText(/מנוי אחד. כל הכלים./)).toBeInTheDocument();
  });
});
