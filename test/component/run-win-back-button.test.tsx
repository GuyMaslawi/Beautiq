// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));

import { RunWinBackButton } from "@/app/admin/businesses/[businessId]/_components/run-win-back-button";

beforeEach(() => vi.clearAllMocks());

const OK_RESULT = {
  processed: 1,
  totalSent: 2,
  totalFailed: 0,
  totalMock: 1,
  results: [
    {
      businessId: "b1",
      businessName: "ביז",
      success: true,
      sentCount: 2,
      failedCount: 0,
      skippedCount: 0,
      mockSkipCount: 1,
      runId: "r1",
    },
  ],
};

describe("RunWinBackButton", () => {
  it("renders the idle trigger", () => {
    render(<RunWinBackButton businessId="b1" />);
    expect(
      screen.getByRole("button", { name: /הפעל Win-Back עכשיו/ }),
    ).toBeInTheDocument();
  });

  it("calls the run-now API with the businessId and shows the summary on success", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(OK_RESULT) }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<RunWinBackButton businessId="b1" />);
    await userEvent.click(screen.getByRole("button", { name: /הפעל Win-Back/ }));

    await waitFor(() => {
      expect(screen.getByText(/הושלם/)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/automation/run-now",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ businessId: "b1" }),
      }),
    );
    // raw result block is rendered
    expect(screen.getByText("תוצאת הרצה")).toBeInTheDocument();
    expect(m.refresh).toHaveBeenCalled();
  });

  it("surfaces the server error message on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "נכשל" }),
        }),
      ),
    );
    render(<RunWinBackButton businessId="b1" />);
    await userEvent.click(screen.getByRole("button", { name: /הפעל Win-Back/ }));
    expect(await screen.findByText("נכשל")).toBeInTheDocument();
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("falls back to a status-code message when no error field is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) }),
      ),
    );
    render(<RunWinBackButton businessId="b1" />);
    await userEvent.click(screen.getByRole("button", { name: /הפעל Win-Back/ }));
    expect(await screen.findByText("שגיאה 403")).toBeInTheDocument();
  });

  it("handles a thrown fetch (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<RunWinBackButton businessId="b1" />);
    await userEvent.click(screen.getByRole("button", { name: /הפעל Win-Back/ }));
    expect(await screen.findByText(/offline/)).toBeInTheDocument();
  });
});
