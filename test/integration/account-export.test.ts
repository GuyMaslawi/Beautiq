import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ייצוא הנתונים של בעלת העסק.
 *
 * שתי הסכנות האמיתיות כאן: (1) דליפה בין-דיירית — קובץ שמכיל שורה של עסק
 * אחר; (2) קובץ פגום שנפתח כג'יבריש או מריץ נוסחה ב-Excel. שתיהן נבדקות.
 */

const client = { findMany: vi.fn() };
const booking = { findMany: vi.fn() };
vi.mock("@/server/db/prisma", () => ({
  prisma: {
    client: { findMany: (...a: unknown[]) => client.findMany(...a) },
    booking: { findMany: (...a: unknown[]) => booking.findMany(...a) },
  },
}));

import {
  exportClientsCsv,
  exportBookingsCsv,
  buildExport,
  isExportType,
} from "@/server/account/export";

const TENANT = { businessId: "biz_1" };

function decimal(value: string) {
  return { toString: () => value };
}

beforeEach(() => {
  client.findMany.mockReset();
  booking.findMany.mockReset();
});

describe("isExportType", () => {
  it("accepts only the known export types", () => {
    expect(isExportType("clients")).toBe(true);
    expect(isExportType("bookings")).toBe(true);
    expect(isExportType("everything")).toBe(false);
    expect(isExportType(null)).toBe(false);
  });
});

describe("exportClientsCsv", () => {
  it("scopes the query to the current business", async () => {
    client.findMany.mockResolvedValue([]);

    await exportClientsCsv(TENANT);

    const args = client.findMany.mock.calls[0][0] as {
      where: { businessId: string };
    };
    expect(args.where.businessId).toBe("biz_1");
  });

  it("writes a header row and one row per client", async () => {
    client.findMany.mockResolvedValue([
      {
        fullName: "יעל כהן",
        phone: "0501234567",
        email: null,
        notes: null,
        totalBookings: 4,
        noShowCount: 1,
        cancellationCount: 0,
        totalSpent: decimal("480.00"),
        lastVisitAt: new Date("2026-07-01T09:00:00Z"),
        whatsappOptIn: true,
        marketingOptIn: false,
        unsubscribedAt: null,
        createdAt: new Date("2026-01-15T09:00:00Z"),
      },
    ]);

    const result = await exportClientsCsv(TENANT);
    const lines = result.content.split("\r\n");

    expect(result.rowCount).toBe(1);
    expect(lines[0]).toContain("שם מלא");
    expect(lines[1]).toContain("יעל כהן");
    expect(lines[1]).toContain("0501234567");
    // הסכמות מוצגות בעברית ולא כ-true/false.
    expect(lines[1]).toContain("כן");
    expect(lines[1]).toContain("לא");
  });

  it("produces a header-only file when the business has no clients", async () => {
    client.findMany.mockResolvedValue([]);

    const result = await exportClientsCsv(TENANT);

    expect(result.rowCount).toBe(0);
    expect(result.content.split("\r\n").filter(Boolean)).toHaveLength(1);
  });

  it("neutralises a client note that Excel would run as a formula", async () => {
    client.findMany.mockResolvedValue([
      {
        fullName: "=HYPERLINK(\"http://evil\")",
        phone: "0500000000",
        email: null,
        notes: null,
        totalBookings: 0,
        noShowCount: 0,
        cancellationCount: 0,
        totalSpent: decimal("0"),
        lastVisitAt: null,
        whatsappOptIn: false,
        marketingOptIn: false,
        unsubscribedAt: null,
        createdAt: new Date("2026-01-15T09:00:00Z"),
      },
    ]);

    const result = await exportClientsCsv(TENANT);

    expect(result.content).toContain("'=HYPERLINK");
  });
});

describe("exportBookingsCsv", () => {
  const row = {
    startTime: new Date("2026-07-20T11:30:00Z"),
    endTime: new Date("2026-07-20T12:30:00Z"),
    status: "completed",
    source: "public",
    priceSnapshot: decimal("180.00"),
    durationMinutesSnapshot: 60,
    notes: null,
    cancellationReason: null,
    createdAt: new Date("2026-07-01T08:00:00Z"),
    client: { fullName: "נועה לוי", phone: "0521111111" },
    service: { name: "מניקור ג'ל" },
  };

  it("scopes the query to the current business", async () => {
    booking.findMany.mockResolvedValue([]);

    await exportBookingsCsv(TENANT);

    const args = booking.findMany.mock.calls[0][0] as {
      where: { businessId: string };
    };
    expect(args.where.businessId).toBe("biz_1");
  });

  it("renders status and source in Hebrew, and times in Israel time", async () => {
    booking.findMany.mockResolvedValue([row]);

    const result = await exportBookingsCsv(TENANT);
    const line = result.content.split("\r\n")[1];

    expect(line).toContain("הושלם");
    expect(line).toContain("דף ההזמנות");
    expect(line).toContain("נועה לוי");
    // 11:30 UTC בקיץ = 14:30 בישראל.
    expect(line).toContain("14:30");
  });

  it("keeps a service name containing a comma in one cell", async () => {
    booking.findMany.mockResolvedValue([
      { ...row, service: { name: "לק ג'ל, כולל הסרה" } },
    ]);

    const result = await exportBookingsCsv(TENANT);

    expect(result.content).toContain('"לק ג\'ל, כולל הסרה"');
  });
});

describe("buildExport", () => {
  it("routes each type to the matching export", async () => {
    client.findMany.mockResolvedValue([]);
    booking.findMany.mockResolvedValue([]);

    expect((await buildExport(TENANT, "clients")).fileNameBase).toBe("לקוחות");
    expect((await buildExport(TENANT, "bookings")).fileNameBase).toBe("תורים");
  });
});
