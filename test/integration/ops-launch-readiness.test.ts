import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * מסך "מצב המערכת" הוא ההגנה היחידה מפני הכשלים השקטים: מצב בדיקה של WhatsApp
 * שנשאר דלוק, ערוץ התראות שלא חובר, ומשימה מתוזמנת שהפסיקה לרוץ. אם ההיגיון
 * כאן יתקלקל, המסך יראה ירוק בזמן שאף לקוחה לא מקבלת הודעה — כלומר גרוע יותר
 * מלא להציג כלום.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

// בדיקת הטוקן יוצאת לרשת אל Meta — כאן נבדק מה המסך *עושה* עם התשובה.
const metaTokenStatus = vi.fn();
vi.mock("@/server/ops/meta-token", () => ({
  getMetaTokenStatus: () => metaTokenStatus(),
}));

import {
  getCronHealth,
  CRON_JOBS,
  recordCronRun,
  withCronHeartbeat,
} from "@/server/ops/cron-heartbeat";
import { getLaunchReadiness } from "@/server/ops/launch-readiness";

const TOKEN_OK = {
  configured: true,
  valid: true,
  neverExpires: true,
  expiresAt: null,
  daysLeft: null,
  type: "SYSTEM_USER",
  scopes: ["whatsapp_business_messaging"],
  checkFailed: false,
};

const NOW = new Date("2026-08-03T12:00:00.000Z");
const ENV = { ...process.env };

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.activityLog.findMany.mockResolvedValue([]);
  metaTokenStatus.mockResolvedValue(TOKEN_OK);
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("דופק המשימות המתוזמנות", () => {
  it("מסמן כשקטה משימה שלא רצה מעולם", async () => {
    const rows = await getCronHealth(NOW);
    expect(rows).toHaveLength(CRON_JOBS.length);
    expect(rows.every((r) => r.stale)).toBe(true);
    expect(rows.every((r) => r.lastRunAt === null)).toBe(true);
  });

  it("רישום ריצה לא נשען על סשן ולא מפיל את המשימה כשהכתיבה נכשלת", async () => {
    prisma.activityLog.create.mockRejectedValue(new Error("db down"));

    await expect(recordCronRun("loyalty", "ok", { sent: 3 })).resolves.toBeUndefined();

    const { data } = prisma.activityLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data).toMatchObject({
      businessId: null,
      userId: null,
      actorType: "system",
      action: "cron.loyalty",
    });
  });

  it("רושמת ריצה גם כשהמשימה יצאה מוקדם ולא עשתה כלום", async () => {
    // זה בדיוק הבאג שהיה: 'אין עסקים מתוזמנים לשעה הזו' → יציאה מוקדמת →
    // שום רישום → המסך הכריז "לא רצה מעולם" על משימה שרצה בפועל כל שעה.
    const res = await withCronHeartbeat("win-back", async () => ({
      ok: true,
      status: 200,
    }));

    expect(res.status).toBe(200);
    const { data } = prisma.activityLog.create.mock.calls[0][0] as {
      data: { action: string; metadata: { outcome: string } };
    };
    expect(data.action).toBe("cron.win-back");
    expect(data.metadata.outcome).toBe("ok");
  });

  it("תשובת שגיאה מהמשימה נרשמת כ-error", async () => {
    await withCronHeartbeat("loyalty", async () => ({ ok: false, status: 503 }));

    const { data } = prisma.activityLog.create.mock.calls[0][0] as {
      data: { metadata: { outcome: string; status: number } };
    };
    expect(data.metadata).toMatchObject({ outcome: "error", status: 503 });
  });

  it("חריגה נרשמת ואז נזרקת הלאה — הטיפול בשגיאה נשאר במקומו", async () => {
    const boom = new Error("boom");
    await expect(
      withCronHeartbeat("review-request", async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    const { data } = prisma.activityLog.create.mock.calls[0][0] as {
      data: { metadata: { outcome: string } };
    };
    expect(data.metadata.outcome).toBe("error");
  });

  it("משימה שרצה זה עתה תקינה, ומשימה ששתקה מעבר למרווח שלה מסומנת", async () => {
    prisma.activityLog.findMany.mockResolvedValue([
      {
        action: "cron.whatsapp-campaigns",
        createdAt: new Date(NOW.getTime() - 5 * 60_000), // כל 10 דקות — תקין
        metadata: { outcome: "ok" },
      },
      {
        action: "cron.morning-reminder",
        createdAt: new Date(NOW.getTime() - 5 * 3_600_000), // כל שעה — שקטה
        metadata: { outcome: "ok" },
      },
    ]);

    const rows = await getCronHealth(NOW);
    const campaigns = rows.find((r) => r.key === "whatsapp-campaigns")!;
    const morning = rows.find((r) => r.key === "morning-reminder")!;

    expect(campaigns.stale).toBe(false);
    expect(campaigns.lastOutcome).toBe("ok");
    expect(morning.stale).toBe(true);
  });
});

describe("בדיקות מוכנות להשקה", () => {
  it("מצב בדיקה דלוק של WhatsApp הוא חוסם", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";

    const { checks } = await getLaunchReadiness();
    const check = checks.find((c) => c.key === "whatsapp-test-mode")!;

    expect(check.level).toBe("blocker");
    expect(check.detail).toContain("לא מקבלת");
  });

  it("מצב בדיקה כבוי — תקין", async () => {
    delete process.env.WHATSAPP_TEST_MODE;

    const { checks } = await getLaunchReadiness();
    expect(checks.find((c) => c.key === "whatsapp-test-mode")!.level).toBe("ok");
  });

  it("אימייל התראות לבדו מספיק — אין צורך ב-Webhook", async () => {
    delete process.env.ERROR_ALERT_WEBHOOK_URL;
    process.env.ERROR_ALERT_EMAIL = "alerts@example.com";

    const { checks } = await getLaunchReadiness();
    expect(checks.find((c) => c.key === "error-alerts")!.level).toBe("ok");
  });

  it("טוקן System User ללא תפוגה — תקין", async () => {
    const { checks } = await getLaunchReadiness();
    const token = checks.find((c) => c.key === "meta-token")!;
    expect(token.level).toBe("ok");
    expect(token.detail).toContain("ללא תפוגה");
  });

  it("טוקן תקף שפג בעוד שבוע — חוסם, ומראה כמה ימים נשארו", async () => {
    metaTokenStatus.mockResolvedValue({
      ...TOKEN_OK,
      neverExpires: false,
      expiresAt: new Date("2026-08-10T00:00:00Z"),
      daysLeft: 7,
      type: "USER",
    });

    const { checks } = await getLaunchReadiness();
    const token = checks.find((c) => c.key === "meta-token")!;
    expect(token.level).toBe("blocker");
    expect(token.detail).toContain("7 ימים");
  });

  it("טוקן תקף שפג בעוד חודשיים — אזהרה ולא חוסם", async () => {
    metaTokenStatus.mockResolvedValue({
      ...TOKEN_OK,
      neverExpires: false,
      expiresAt: new Date("2026-10-01T00:00:00Z"),
      daysLeft: 59,
      type: "USER",
    });

    const { checks } = await getLaunchReadiness();
    expect(checks.find((c) => c.key === "meta-token")!.level).toBe("warn");
  });

  it("טוקן שנפסל על ידי Meta — חוסם", async () => {
    metaTokenStatus.mockResolvedValue({ ...TOKEN_OK, valid: false, neverExpires: false });

    const { checks } = await getLaunchReadiness();
    expect(checks.find((c) => c.key === "meta-token")!.level).toBe("blocker");
  });

  it("כשל בבדיקה עצמה הוא אזהרה — לא מכריזים על תקלה שלא הוכחה", async () => {
    metaTokenStatus.mockResolvedValue({
      configured: true,
      valid: false,
      neverExpires: false,
      expiresAt: null,
      daysLeft: null,
      type: null,
      scopes: [],
      checkFailed: true,
      error: "timeout",
    });

    const { checks } = await getLaunchReadiness();
    expect(checks.find((c) => c.key === "meta-token")!.level).toBe("warn");
  });

  it("בלי שום ערוץ התראות — חוסם", async () => {
    delete process.env.ERROR_ALERT_WEBHOOK_URL;
    delete process.env.ERROR_ALERT_EMAIL;

    const { checks, blockers } = await getLaunchReadiness();
    expect(checks.find((c) => c.key === "error-alerts")!.level).toBe("blocker");
    expect(blockers).toBeGreaterThan(0);
  });
});
