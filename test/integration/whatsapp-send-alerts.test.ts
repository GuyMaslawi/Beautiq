import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * התראות על כשל בשליחת WhatsApp.
 *
 * לפני השינוי הזה כשל שליחה נכתב ללוג בלבד: טוקן Meta שפג היה משתיק את כל
 * ההודעות של כל בעלות העסק, ואיש לא היה יודע עד שלקוחה מתלוננת. הבדיקות כאן
 * נועלות את שני הצדדים של האיזון — שתקלת מערכת אכן מתריעה, ושכשל ברמת נמען
 * בודד (לקוחה שאינה בוואטסאפ) לעולם אינו מתריע, אחרת התיבה מוצפת ביום עבודה
 * רגיל ואנחנו מתאמנים להתעלם ממנה.
 */

const captureErrorMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  captureError: (...args: unknown[]) => captureErrorMock(...args),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createMetaCloudApiProvider,
  alertScopeForMetaError,
} from "@/lib/whatsapp/meta-cloud-api";

function metaErrorResponse(code: number, status = 400): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      error: { message: "err", type: "OAuthException", code, fbtrace_id: "trace123" },
    }),
  } as unknown as Response;
}

function provider() {
  return createMetaCloudApiProvider({
    accessToken: "EAAtoken",
    phoneNumberId: "123",
    apiVersion: "v21.0",
  });
}

const SEND_PARAMS = {
  toPhone: "+972501234567",
  templateId: "custom_template",
  templateLanguage: "he",
  businessId: "biz-1",
  clientId: "client-1",
};

beforeEach(() => {
  captureErrorMock.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("alertScopeForMetaError", () => {
  it("מסווג טוקן שפג כתקלת טוקן", () => {
    expect(alertScopeForMetaError(190, 401)).toBe("whatsapp.send.token");
    expect(alertScopeForMetaError(102, 400)).toBe("whatsapp.send.token");
  });

  it("מסווג חריגת מכסה בנפרד מתקלת טוקן", () => {
    expect(alertScopeForMetaError(130429, 400)).toBe("whatsapp.send.limit");
    expect(alertScopeForMetaError(131056, 400)).toBe("whatsapp.send.limit");
  });

  it("מסווג שגיאות תבנית", () => {
    expect(alertScopeForMetaError(131008, 400)).toBe("whatsapp.send.template");
    expect(alertScopeForMetaError(132001, 400)).toBe("whatsapp.send.template");
  });

  it("מסווג הרשאות חסרות וחשבון מוגבל", () => {
    expect(alertScopeForMetaError(200, 403)).toBe("whatsapp.send.permission");
    expect(alertScopeForMetaError(131031, 403)).toBe("whatsapp.send.account");
  });

  it("אינו מתריע על כשל ברמת הנמען הבודד", () => {
    expect(alertScopeForMetaError(131026, 400)).toBeNull();
    expect(alertScopeForMetaError(131047, 400)).toBeNull();
  });

  it("מסווג שגיאת שרת של Meta גם ללא קוד שגיאה", () => {
    expect(alertScopeForMetaError(undefined, 503)).toBe("whatsapp.send.meta_unavailable");
  });

  it("נופל לקטגוריה כללית בקוד לא מוכר", () => {
    expect(alertScopeForMetaError(999999, 400)).toBe("whatsapp.send.other");
  });
});

describe("התראה בפועל מנתיב השליחה", () => {
  it("טוקן שפג מפיק התראה עם ה-scope והקשר הנכונים", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(metaErrorResponse(190, 401));

    const result = await provider().send(SEND_PARAMS);

    expect(result.success).toBe(false);
    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    const [scope, err, context] = captureErrorMock.mock.calls[0] as [string, Error, Record<string, unknown>];
    expect(scope).toBe("whatsapp.send.token");
    expect(err.message).toContain("META_WHATSAPP_ACCESS_TOKEN");
    expect(context.businessId).toBe("biz-1");
    expect(context.metaCode).toBe(190);
  });

  it("לקוחה שאינה בוואטסאפ אינה מפיקה התראה", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(metaErrorResponse(131026));

    const result = await provider().send(SEND_PARAMS);

    expect(result.success).toBe(false);
    expect(captureErrorMock).not.toHaveBeenCalled();
  });

  it("שגיאת רשת מול Meta מפיקה התראה", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    await provider().send(SEND_PARAMS);

    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    expect(captureErrorMock.mock.calls[0][0]).toBe("whatsapp.send.network");
  });

  it("שליחה מוצלחת אינה מפיקה התראה", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messaging_product: "whatsapp", messages: [{ id: "wamid.1" }] }),
    } as unknown as Response);

    const result = await provider().send(SEND_PARAMS);

    expect(result.success).toBe(true);
    expect(captureErrorMock).not.toHaveBeenCalled();
  });

  it("ההתראה אינה מכילה את הטוקן ואת מספר הטלפון המלא", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(metaErrorResponse(190, 401));

    await provider().send(SEND_PARAMS);

    const serialized = JSON.stringify(captureErrorMock.mock.calls[0]);
    expect(serialized).not.toContain("EAAtoken");
    expect(serialized).not.toContain("972501234567");
  });
});
