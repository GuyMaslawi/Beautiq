// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCronTestCard } from "@/components/automations/admin-cron-test-card";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminCronTestCard", () => {
  it("renders the admin header and all three cron buttons", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<AdminCronTestCard businessId="biz-1" />);
    expect(screen.getByText("בדיקות קרון — Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "בדיקת תזכורות עכשיו" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "בדיקת בקשות ביקורת עכשיו" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "בדיקת החזרת לקוחות עכשיו" })).toBeInTheDocument();
  });

  it("POSTs the businessId to the reminder route and shows the sent count", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ processed: 3, totalSent: 2, totalFailed: 0, totalSkipped: 0 }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdminCronTestCard businessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: "בדיקת תזכורות עכשיו" }));

    await waitFor(() => expect(screen.getByText("נשלחו 2")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/automation/reminder-now",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ businessId: "biz-1" }),
      }),
    );
  });

  it("shows 'לא נשלחו' plus failed and skipped counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ processed: 5, totalSent: 0, totalFailed: 1, totalSkipped: 4 }),
        }),
      ),
    );
    const user = userEvent.setup();
    render(<AdminCronTestCard businessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: "בדיקת בקשות ביקורת עכשיו" }));

    await waitFor(() => expect(screen.getByText("לא נשלחו")).toBeInTheDocument());
    expect(screen.getByText("נכשלו 1")).toBeInTheDocument();
    expect(screen.getByText("דולגו 4")).toBeInTheDocument();
  });

  it("surfaces the server error message on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: "נכשל בשרת" }) }),
      ),
    );
    const user = userEvent.setup();
    render(<AdminCronTestCard businessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: "בדיקת החזרת לקוחות עכשיו" }));
    await waitFor(() => expect(screen.getByText("נכשל בשרת")).toBeInTheDocument());
  });

  it("falls back to a status-code error message when no error is provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) })),
    );
    const user = userEvent.setup();
    render(<AdminCronTestCard businessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: "בדיקת תזכורות עכשיו" }));
    await waitFor(() => expect(screen.getByText("שגיאה 403")).toBeInTheDocument());
  });

  it("shows the thrown error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const user = userEvent.setup();
    render(<AdminCronTestCard businessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: "בדיקת תזכורות עכשיו" }));
    await waitFor(() => expect(screen.getByText(/offline/)).toBeInTheDocument());
  });
});
