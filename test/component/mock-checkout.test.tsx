// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MockCheckout } from "@/app/pay/mock/[id]/mock-checkout";

function renderCheckout() {
  return render(
    <MockCheckout
      bookingPaymentId="bp_1"
      txn="txn_abc"
      amountLabel="₪150"
      businessName="סטודיו יופי"
    />,
  );
}

let hrefSpy: { value: string };

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
  );
  // window.location.href is a navigation; intercept it without jsdom navigating.
  hrefSpy = { value: "" };
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return hrefSpy.value;
      },
      set href(v: string) {
        hrefSpy.value = v;
      },
    },
  });
});

describe("MockCheckout", () => {
  it("renders the mock payment UI with amount and business name", () => {
    renderCheckout();
    expect(screen.getByText("עמוד תשלום לדוגמה (מצב בדיקה)")).toBeInTheDocument();
    expect(screen.getByText("תשלום לסטודיו יופי")).toBeInTheDocument();
    expect(screen.getByText("₪150")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "אישור תשלום" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ביטול / כישלון תשלום" }),
    ).toBeInTheDocument();
  });

  it("on 'paid' fires the mock webhook then navigates to the success return URL", async () => {
    renderCheckout();
    await userEvent.click(screen.getByRole("button", { name: "אישור תשלום" }));

    await waitFor(() => {
      expect(hrefSpy.value).toBe(
        "/api/payments/return/success?bp=bp_1",
      );
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/payments/mock/webhook",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ txn: "txn_abc", status: "paid" }),
      }),
    );
  });

  it("on 'failed' navigates to the failure return URL", async () => {
    renderCheckout();
    await userEvent.click(
      screen.getByRole("button", { name: "ביטול / כישלון תשלום" }),
    );
    await waitFor(() => {
      expect(hrefSpy.value).toBe(
        "/api/payments/return/failure?bp=bp_1",
      );
    });
    const body = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body;
    expect(JSON.parse(body)).toEqual({ txn: "txn_abc", status: "failed" });
  });

  it("still navigates even when the webhook fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    renderCheckout();
    await userEvent.click(screen.getByRole("button", { name: "אישור תשלום" }));
    await waitFor(() => {
      expect(hrefSpy.value).toBe("/api/payments/return/success?bp=bp_1");
    });
  });
});
