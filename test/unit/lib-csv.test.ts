import { describe, it, expect } from "vitest";
import { csvCell, toCsv, safeFileName } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves plain values untouched", () => {
    expect(csvCell("יעל כהן")).toBe("יעל כהן");
    expect(csvCell(42)).toBe("42");
  });

  it("returns an empty cell for null/undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values containing a comma, quote or newline", () => {
    expect(csvCell("כהן, יעל")).toBe('"כהן, יעל"');
    expect(csvCell('הערה "חשובה"')).toBe('"הערה ""חשובה"""');
    expect(csvCell("שורה\nשנייה")).toBe('"שורה\nשנייה"');
  });

  // CSV injection: תא שמתחיל ב-= או @ מורץ כנוסחה כשפותחים את הקובץ ב-Excel.
  it("neutralises cells that Excel would treat as a formula", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+972501234567")).toBe("'+972501234567");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@handle")).toBe("'@handle");
  });

  it("still quotes a neutralised cell that also contains a comma", () => {
    expect(csvCell("=A1,B2")).toBe(`"'=A1,B2"`);
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM so Excel reads Hebrew correctly", () => {
    const csv = toCsv(["שם"], [["יעל"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("joins rows with CRLF and ends with a newline", () => {
    const csv = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("﻿a,b\r\n1,2\r\n3,4\r\n");
  });

  it("handles a header-only export (no rows)", () => {
    expect(toCsv(["שם", "טלפון"], [])).toBe("﻿שם,טלפון\r\n");
  });
});

describe("safeFileName", () => {
  it("keeps Hebrew letters and digits, replacing everything else", () => {
    expect(safeFileName("Allura-לקוחות-yael studio", "csv")).toBe(
      "Allura-לקוחות-yael-studio.csv",
    );
  });

  // שם קובץ נכנס לכותרת Content-Disposition — מרכאה או שורה חדשה שם היא
  // הזרקת כותרת, לא רק שם מכוער.
  it("strips characters that would break the Content-Disposition header", () => {
    expect(safeFileName('bad"name\r\nX-Injected: 1', "csv")).toBe(
      "bad-name-X-Injected-1.csv",
    );
  });

  it("falls back to a default when nothing usable remains", () => {
    expect(safeFileName("///", "csv")).toBe("allura.csv");
  });

  it("caps the length", () => {
    const name = safeFileName("a".repeat(200), "csv");
    expect(name.length).toBeLessThanOrEqual(64);
  });
});
