import { describe, it, expect } from "vitest";
import {
  NAV_ITEMS,
  NAV_GROUPS,
} from "@/components/layout/nav-items";

describe("nav-items data", () => {
  it("NAV_ITEMS is a non-empty list where every item has href+label", () => {
    expect(NAV_ITEMS.length).toBeGreaterThan(0);
    for (const item of NAV_ITEMS) {
      expect(item.href).toMatch(/^\//);
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("hrefs in NAV_ITEMS are unique", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("NAV_GROUPS every group has a label and valid items", () => {
    expect(NAV_GROUPS.length).toBeGreaterThan(0);
    for (const group of NAV_GROUPS) {
      expect(typeof group.label).toBe("string");
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(item.href).toMatch(/^\//);
        expect(typeof item.label).toBe("string");
      }
    }
  });

  it("every grouped item exists in the flat NAV_ITEMS list", () => {
    const flat = new Set(NAV_ITEMS.map((i) => i.href));
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(flat.has(item.href)).toBe(true);
      }
    }
  });
});
