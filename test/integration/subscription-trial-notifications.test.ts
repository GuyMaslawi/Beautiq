import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * ההתראות על סוף תקופת הניסיון. אין דגל "נשלח" במסד — החלונות הם שמונעים
 * הודעות כפולות, ולכן הם מה שנבדק כאן: מי שהניסיון שלה נגמר בעוד יומיים-שלושה
 * מקבלת התראה מוקדמת אחת, ומי שהניסיון שלה נגמר ב-24 השעות האחרונות מקבלת
 * הודעת סיום אחת.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const sendEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...(a as [])),
  isEmailConfigured: () => true,
}));

import { notifyTrialLifecycle } from "@/server/subscription/trial-notifications";

const NOW = new Date("2026-08-03T03:00:00.000Z");
const DAY = 86_400_000;

beforeEach(() => {
  resetPrismaMock(prisma);
  sendEmail.mockClear();
});

describe("התראות תקופת ניסיון", () => {
  it("שולחת התראה מוקדמת ליומיים-שלושה לפני הסיום, והודעת סיום ליממה האחרונה", async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([
        {
          id: "u1",
          email: "soon@example.com",
          name: "נועה",
          planExpiresAt: new Date(NOW.getTime() + 2.5 * DAY),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "u2",
          email: "over@example.com",
          name: null,
          planExpiresAt: new Date(NOW.getTime() - 3 * 3_600_000),
        },
      ]);

    const result = await notifyTrialLifecycle(NOW);

    expect(result).toEqual({ ending: 1, ended: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const [first, second] = sendEmail.mock.calls.map(
      (c) => c[0] as { to: string; subject: string; text: string },
    );
    expect(first.to).toBe("soon@example.com");
    expect(first.subject).toContain("מסתיימת בקרוב");
    expect(first.text).toContain("נועה");
    expect(second.to).toBe("over@example.com");
    expect(second.subject).toContain("הסתיימה");
    // ההבטחה שהכי חשוב שתופיע: הנתונים לא נמחקו.
    expect(second.text).toContain("שמורים");
  });

  it("מחפשת רק חשבונות שהגישה שלהם עדיין פתוחה, בחלונות של יממה", async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await notifyTrialLifecycle(NOW);

    const [endingArgs, endedArgs] = prisma.user.findMany.mock.calls.map(
      (c) => c[0] as { where: { plan: unknown; planExpiresAt: { gte: Date; lt: Date } } },
    );

    expect(endingArgs.where.plan).toEqual({ not: null });
    expect(endingArgs.where.planExpiresAt.gte.getTime()).toBe(NOW.getTime() + 2 * DAY);
    expect(endingArgs.where.planExpiresAt.lt.getTime()).toBe(NOW.getTime() + 3 * DAY);

    expect(endedArgs.where.planExpiresAt.gte.getTime()).toBe(NOW.getTime() - DAY);
    expect(endedArgs.where.planExpiresAt.lt.getTime()).toBe(NOW.getTime());
  });

  it("לא שולחת דבר כשאין אף ניסיון בחלון", async () => {
    prisma.user.findMany.mockResolvedValue([]);

    const result = await notifyTrialLifecycle(NOW);

    expect(result).toEqual({ ending: 0, ended: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
