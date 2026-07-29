import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captureError, __resetErrorAlertThrottleForTests } from "@/lib/logger";

/**
 * ההתראות הן מנגנון "יודעים שמשהו נשבר" — ולכן שתי התכונות שנבדקות כאן הן
 * קריטיות באותה מידה: שההתראה נשלחת, ושהיא לא מציפה את הערוץ כשתקלה חוזרת
 * בכל בקשה.
 */
describe("captureError → error alert webhook", () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response("ok")));

  beforeEach(() => {
    fetchMock.mockClear();
    __resetErrorAlertThrottleForTests();
    vi.stubGlobal("fetch", fetchMock);
    // console.error נשאר שקט כדי שפלט הבדיקות יישאר קריא.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does nothing when no webhook is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", "");

    captureError("test.scope", new Error("boom"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // בפיתוח לא רוצים שכל שגיאה מקומית תצלצל בערוץ ההתראות האמיתי.
  it("does not alert outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", "https://hook.example/alerts");

    captureError("test.scope", new Error("boom"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a JSON alert in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", "https://hook.example/alerts");

    captureError("payments.webhook", new Error("Grow rejected the call"), {
      businessId: "biz_1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(url).toBe("https://hook.example/alerts");
    expect(init.method).toBe("POST");

    const payload = JSON.parse(init.body);
    expect(payload.scope).toBe("payments.webhook");
    expect(payload.message).toBe("Grow rejected the call");
    expect(payload.context.businessId).toBe("biz_1");
    expect(payload.text).toContain("payments.webhook");
  });

  it("throttles repeats of the same scope", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", "https://hook.example/alerts");

    for (let i = 0; i < 5; i++) {
      captureError("cron.morning-reminder", new Error("db down"));
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still alerts for a different scope", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", "https://hook.example/alerts");

    captureError("scope.a", new Error("a"));
    captureError("scope.b", new Error("b"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never throws when the webhook itself fails", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", "https://hook.example/alerts");
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("network")));

    expect(() => captureError("scope.c", new Error("boom"))).not.toThrow();
  });
});
