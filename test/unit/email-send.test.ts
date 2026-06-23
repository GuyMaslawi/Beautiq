import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isEmailConfigured", () => {
  it("is false when key/from are missing, true when both set", () => {
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Allura <noreply@allura.info>";
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendEmail — best-effort transport", () => {
  it("skips (does not throw, does not fetch) when not configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await sendEmail({ to: "owner@example.com", subject: "x", text: "y" });

    expect(res).toEqual({ ok: false, skipped: true, reason: "email_not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs to the provider and returns ok with the message id when configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Allura <noreply@allura.info>";
    type FetchInit = { method: string; headers: Record<string, string>; body: string };
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "email_123" }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await sendEmail({
      to: "owner@example.com",
      subject: "בקשת תור חדשה מ־Allura",
      text: "פרטים",
    });

    expect(res).toEqual({ ok: true, id: "email_123" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as FetchInit;
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body.to).toBe("owner@example.com");
    expect(body.from).toBe("Allura <noreply@allura.info>");
  });

  it("returns a non-OK reason (never throws) on provider error status", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Allura <noreply@allura.info>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 422, text: async () => "bad" })),
    );

    const res = await sendEmail({ to: "x@y.com", subject: "s", text: "t" });
    expect(res).toEqual({ ok: false, reason: "provider_status_422" });
  });

  it("returns a dispatch_error (never throws) when fetch rejects", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Allura <noreply@allura.info>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );

    const res = await sendEmail({ to: "x@y.com", subject: "s", text: "t" });
    expect(res).toEqual({ ok: false, reason: "dispatch_error" });
  });
});
