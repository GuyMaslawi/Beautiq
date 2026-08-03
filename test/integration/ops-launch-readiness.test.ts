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

import { getCronHealth, CRON_JOBS, recordCronRun } from "@/server/ops/cron-heartbeat";
import { getLaunchReadiness } from "@/server/ops/launch-readiness";

const NOW = new Date("2026-08-03T12:00:00.000Z");
const ENV = { ...process.env };

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.activityLog.findMany.mockResolvedValue([]);
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

  it("בלי שום ערוץ התראות — חוסם", async () => {
    delete process.env.ERROR_ALERT_WEBHOOK_URL;
    delete process.env.ERROR_ALERT_EMAIL;

    const { checks, blockers } = await getLaunchReadiness();
    expect(checks.find((c) => c.key === "error-alerts")!.level).toBe("blocker");
    expect(blockers).toBeGreaterThan(0);
  });
});
