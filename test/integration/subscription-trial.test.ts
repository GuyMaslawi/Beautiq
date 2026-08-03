import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * תקופת ניסיון חינם — הזרימה שבה בעלת עסק מקבלת גישה לפני שהיא משלמת.
 *
 * הבדיקות כאן מקבעות את שלוש הנקודות שבהן הזרימה נשברה:
 *   1. תשלום אחרי ניסיון חייב לנקות את planExpiresAt. בלי זה בעלת העסק שילמה,
 *      השער עדיין ראה תפוגה שעברה, והיא הוחזרה למסך התשלום — ושילמה שוב.
 *   2. אפשר להעניק ניסיון לחשבון שעדיין אין לו עסק — זה המצב של כל נרשמת חדשה.
 *   3. תאריך ניסיון "עד ה-X" נגמר בסוף אותו יום בישראל, לא ב-02:00 בלילה.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("@/server/admin/auth", () => ({
  requirePlatformAdmin: vi.fn().mockResolvedValue(undefined),
  isPlatformAdmin: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/activity/log", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/subscription/grow", () => ({
  isGrowConfigured: () => false,
  cancelDirectDebit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));

import { confirmSubscriptionPayment } from "@/server/subscription/service";
import { adminSetAccountPlanByUserAction } from "@/server/admin/account-actions";

const SUB = {
  id: "sub_1",
  userId: "usr_1",
  plan: "standard" as const,
  priceMinor: 19900,
  providerTransactionId: null,
  currentPeriodEnd: null,
  activatedAt: null,
};

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.$transaction.mockResolvedValue([]);
  prisma.subscriptionCharge.create.mockResolvedValue({});
  prisma.accountSubscription.update.mockResolvedValue({});
  prisma.user.update.mockResolvedValue({});
});

describe("המרת תקופת ניסיון לתשלום", () => {
  it("מנקה את תאריך התפוגה של הניסיון כשהתשלום מאושר", async () => {
    await confirmSubscriptionPayment(SUB, { transactionId: "txn_1" });

    // עדכון המשתמש נבנה בתוך prisma.$transaction — נמצא אותו לפי המודל.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const arg = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where.id).toBe("usr_1");
    expect(arg.data.plan).toBe("standard");
    // הלב של התיקון: בלי זה הגישה נשארת סגורה אחרי תשלום אמיתי.
    expect(arg.data.planExpiresAt).toBeNull();
  });
});

describe("הענקת ניסיון לפי חשבון (ולא לפי עסק)", () => {
  it("פותחת גישה לבעלת עסק שנרשמה ועדיין אין לה עסק", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "usr_new",
      name: "רות",
      email: "ruth@example.com",
      isAdmin: false,
      plan: null,
      customPriceMinor: null,
      memberships: [], // עדיין לא הקימה עסק — כאן הזרימה הישנה נעצרה
    });
    prisma.accountSubscription.findUnique.mockResolvedValue(null);

    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const res = await adminSetAccountPlanByUserAction("usr_new", "standard", future);

    expect(res.success).toBe(true);
    const arg = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { plan: string | null; planExpiresAt: Date | null };
    };
    expect(arg.where.id).toBe("usr_new");
    expect(arg.data.plan).toBe("standard");
    expect(arg.data.planExpiresAt).toBeInstanceOf(Date);
  });

  it("מסיימת את הניסיון בסוף היום שנבחר, לא בתחילתו", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "usr_new",
      name: null,
      email: "ruth@example.com",
      isAdmin: false,
      plan: null,
      customPriceMinor: null,
      memberships: [],
    });
    prisma.accountSubscription.findUnique.mockResolvedValue(null);

    const day = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    await adminSetAccountPlanByUserAction("usr_new", "standard", day);

    const { data } = prisma.user.update.mock.calls[0][0] as {
      data: { planExpiresAt: Date };
    };
    // חצות UTC של אותו יום היה חותך לה את היום האחרון (02:00/03:00 בישראל).
    const utcMidnight = new Date(`${day}T00:00:00.000Z`).getTime();
    expect(data.planExpiresAt.getTime()).toBeGreaterThan(utcMidnight + 20 * 3_600_000);
  });

  it("דוחה תאריך תפוגה שכבר עבר", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "usr_new",
      name: null,
      email: "ruth@example.com",
      isAdmin: false,
      plan: null,
      customPriceMinor: null,
      memberships: [],
    });

    const past = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const res = await adminSetAccountPlanByUserAction("usr_new", "standard", past);

    expect(res.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("מחזירה שגיאה כשהמשתמש לא נמצא — ולא נוגעת בשום חשבון", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await adminSetAccountPlanByUserAction("nope", "standard", null);

    expect(res.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
