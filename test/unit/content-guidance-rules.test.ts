import { describe, it, expect } from "vitest";
import { generateGuidanceItems } from "@/lib/guidance/rules";
import type { GuidanceQueryData } from "@/server/guidance/queries";

function data(overrides: Partial<GuidanceQueryData> = {}): GuidanceQueryData {
  return {
    activeServicesCount: 1,
    activeAvailabilityCount: 1,
    pendingDepositCount: 0,
    todayBookingsCount: 0,
    pendingBookingsCount: 0,
    lostClientsCount: 0,
    noShowClientsCount: 0,
    upcomingBookingsCount: 1,
    recentCompletedBookingsCount: 0,
    pricingConcernCount: 0,
    ...overrides,
  };
}

function ids(items: ReturnType<typeof generateGuidanceItems>) {
  return items.map((i) => i.id);
}

describe("generateGuidanceItems — empty / all-clear", () => {
  it("returns no items when nothing needs attention", () => {
    expect(generateGuidanceItems(data(), 0)).toEqual([]);
  });
});

describe("generateGuidanceItems — setup blockers (important)", () => {
  it("flags no-services", () => {
    const items = generateGuidanceItems(data({ activeServicesCount: 0 }), 0);
    expect(ids(items)).toContain("no-services");
    expect(items.find((i) => i.id === "no-services")!.priority).toBe("important");
    expect(items.find((i) => i.id === "no-services")!.href).toBe("/services/new");
  });

  it("flags no-availability", () => {
    const items = generateGuidanceItems(data({ activeAvailabilityCount: 0 }), 0);
    expect(ids(items)).toContain("no-availability");
    expect(items.find((i) => i.id === "no-availability")!.href).toBe("/availability");
  });
});

describe("generateGuidanceItems — individual rules", () => {
  it("flags pending deposits (C)", () => {
    expect(ids(generateGuidanceItems(data({ pendingDepositCount: 2 }), 0))).toContain(
      "pending-deposits",
    );
  });

  it("flags pending bookings (E)", () => {
    expect(ids(generateGuidanceItems(data({ pendingBookingsCount: 1 }), 0))).toContain(
      "pending-bookings",
    );
  });

  it("flags today's bookings (D)", () => {
    expect(ids(generateGuidanceItems(data({ todayBookingsCount: 3 }), 0))).toContain(
      "today-bookings",
    );
  });

  it("flags lost clients → bring-back (F)", () => {
    const items = generateGuidanceItems(data({ lostClientsCount: 4 }), 0);
    expect(ids(items)).toContain("clients-not-returned");
    expect(items.find((i) => i.id === "clients-not-returned")!.href).toBe("/bring-back");
  });

  it("flags no-show clients (G)", () => {
    expect(ids(generateGuidanceItems(data({ noShowClientsCount: 1 }), 0))).toContain(
      "no-show-clients",
    );
  });

  it("flags recent completed → automations (J)", () => {
    const items = generateGuidanceItems(data({ recentCompletedBookingsCount: 2 }), 0);
    expect(ids(items)).toContain("reputation");
    expect(items.find((i) => i.id === "reputation")!.href).toBe("/automations");
  });

  it("flags pricing concerns (K)", () => {
    const items = generateGuidanceItems(data({ pricingConcernCount: 1 }), 0);
    expect(ids(items)).toContain("pricing-concerns");
    expect(items.find((i) => i.id === "pricing-concerns")!.priority).toBe("info");
  });
});

describe("generateGuidanceItems — conditional rules", () => {
  it("flags no-upcoming-bookings only when setup is complete (H)", () => {
    const ready = generateGuidanceItems(data({ upcomingBookingsCount: 0 }), 0);
    expect(ids(ready)).toContain("no-upcoming-bookings");

    // When services are missing, the no-upcoming rule must NOT fire (avoid noise).
    const notReady = generateGuidanceItems(
      data({ activeServicesCount: 0, upcomingBookingsCount: 0 }),
      0,
    );
    expect(ids(notReady)).not.toContain("no-upcoming-bookings");
  });

  it("flags empty-slots only when setup is complete and count > 0 (I)", () => {
    const withSlots = generateGuidanceItems(data(), 5);
    expect(ids(withSlots)).toContain("empty-slots");
    expect(withSlots.find((i) => i.id === "empty-slots")!.href).toBe(
      "/dashboard#empty-slots",
    );

    // No empty-slot card when setup is incomplete even if slots > 0.
    const incompleteSetup = generateGuidanceItems(
      data({ activeAvailabilityCount: 0 }),
      5,
    );
    expect(ids(incompleteSetup)).not.toContain("empty-slots");

    // No card when count is 0.
    expect(ids(generateGuidanceItems(data(), 0))).not.toContain("empty-slots");
  });
});

describe("generateGuidanceItems — sorting and capping", () => {
  it("sorts important before recommended before info", () => {
    const items = generateGuidanceItems(
      data({
        pendingDepositCount: 1, // important
        todayBookingsCount: 1, // recommended
        noShowClientsCount: 1, // info
      }),
      0,
    );
    const order = { important: 0, recommended: 1, info: 2 } as const;
    for (let i = 1; i < items.length; i++) {
      expect(order[items[i].priority]).toBeGreaterThanOrEqual(
        order[items[i - 1].priority],
      );
    }
  });

  it("caps the result at 5 cards", () => {
    const items = generateGuidanceItems(
      data({
        activeServicesCount: 0,
        activeAvailabilityCount: 0,
        pendingDepositCount: 1,
        pendingBookingsCount: 1,
        todayBookingsCount: 1,
        lostClientsCount: 1,
        noShowClientsCount: 1,
        recentCompletedBookingsCount: 1,
        pricingConcernCount: 1,
      }),
      3,
    );
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it("prioritises important cards when capping (important cards survive)", () => {
    const items = generateGuidanceItems(
      data({
        activeServicesCount: 0, // important
        activeAvailabilityCount: 0, // important
        pendingDepositCount: 1, // important
        pendingBookingsCount: 1, // important
        noShowClientsCount: 1, // info — should be dropped first
        recentCompletedBookingsCount: 1, // recommended
        pricingConcernCount: 1, // info
      }),
      0,
    );
    expect(items.length).toBe(5);
    // The two info cards (no-show, pricing) should be pushed out by the 4 important + reputation.
    expect(items.every((i) => i.priority !== "info")).toBe(true);
  });

  it("each item carries Hebrew title, description and action label", () => {
    const items = generateGuidanceItems(
      data({ activeServicesCount: 0, pendingDepositCount: 1 }),
      0,
    );
    for (const item of items) {
      expect(item.title).toMatch(/[֐-׿]/);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.actionLabel.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
    }
  });
});
