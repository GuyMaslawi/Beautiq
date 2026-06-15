import { describe, it, expect } from "vitest";
import {
  calcPricePerHour,
  calcBusinessAvgPricePerHour,
  calcBusinessAvgCompletedBookings,
  generateServiceInsights,
  hasPricingConcerns,
  type ServiceInsightInput,
} from "@/lib/pricing/insights";

function svc(overrides: Partial<ServiceInsightInput> = {}): ServiceInsightInput {
  return {
    durationMinutes: 60,
    price: 150,
    completedBookingCount: 0,
    marketMinPrice: null,
    marketAveragePrice: null,
    marketMaxPrice: null,
    ...overrides,
  };
}

describe("calcPricePerHour", () => {
  it("computes price per hour from price + duration", () => {
    expect(calcPricePerHour(150, 60)).toBe(150);
    expect(calcPricePerHour(150, 30)).toBe(300);
    expect(calcPricePerHour(150, 120)).toBe(75);
  });

  it("returns 0 for non-positive duration (no divide-by-zero)", () => {
    expect(calcPricePerHour(150, 0)).toBe(0);
    expect(calcPricePerHour(150, -10)).toBe(0);
  });
});

describe("calcBusinessAvgPricePerHour", () => {
  it("averages per-hour values across services", () => {
    expect(
      calcBusinessAvgPricePerHour([
        { price: 150, durationMinutes: 60 }, // 150
        { price: 150, durationMinutes: 30 }, // 300
      ]),
    ).toBe(225);
  });

  it("returns 0 for an empty list", () => {
    expect(calcBusinessAvgPricePerHour([])).toBe(0);
  });
});

describe("calcBusinessAvgCompletedBookings", () => {
  it("averages counts", () => {
    expect(calcBusinessAvgCompletedBookings([2, 4, 6])).toBe(4);
  });
  it("returns 0 for empty input", () => {
    expect(calcBusinessAvgCompletedBookings([])).toBe(0);
  });
});

describe("generateServiceInsights — market range rule (A)", () => {
  it("flags below_range when price < marketMin", () => {
    const out = generateServiceInsights(
      svc({ price: 100, marketMinPrice: 150, marketMaxPrice: 250 }),
      0,
      0,
    );
    expect(out.map((i) => i.type)).toContain("below_range");
    const insight = out.find((i) => i.type === "below_range")!;
    expect(insight.severity).toBe("warning");
  });

  it("flags above_range when price > marketMax", () => {
    const out = generateServiceInsights(
      svc({ price: 300, marketMinPrice: 150, marketMaxPrice: 250 }),
      0,
      0,
    );
    expect(out.map((i) => i.type)).toContain("above_range");
    expect(out.find((i) => i.type === "above_range")!.severity).toBe("info");
  });

  it("flags within_range when price is inside the range (boundary inclusive)", () => {
    const atMin = generateServiceInsights(
      svc({ price: 150, marketMinPrice: 150, marketMaxPrice: 250 }),
      0,
      0,
    );
    expect(atMin.map((i) => i.type)).toContain("within_range");
    expect(atMin.find((i) => i.type === "within_range")!.severity).toBe("positive");

    const atMax = generateServiceInsights(
      svc({ price: 250, marketMinPrice: 150, marketMaxPrice: 250 }),
      0,
      0,
    );
    expect(atMax.map((i) => i.type)).toContain("within_range");
  });

  it("emits no range insight when min/max are null", () => {
    const out = generateServiceInsights(svc(), 0, 0);
    const rangeTypes = out
      .map((i) => i.type)
      .filter((t) => ["below_range", "within_range", "above_range"].includes(t));
    expect(rangeTypes).toEqual([]);
  });
});

describe("generateServiceInsights — long low price (B) vs low/high hourly (C/D)", () => {
  it("emits long_low_price for a long service below the business avg pph", () => {
    // 90 min, low price → pph below business avg
    const out = generateServiceInsights(
      svc({ durationMinutes: 90, price: 100 }), // pph ≈ 66.6
      150, // business avg pph
      0,
    );
    const types = out.map((i) => i.type);
    expect(types).toContain("long_low_price");
    // long_low_price branch is exclusive of low_hourly_value
    expect(types).not.toContain("low_hourly_value");
  });

  it("emits low_hourly_value for a short service well below avg (not long)", () => {
    // 60 min, pph 60, below 70% of 150 (=105)
    const out = generateServiceInsights(
      svc({ durationMinutes: 60, price: 60 }),
      150,
      0,
    );
    expect(out.map((i) => i.type)).toContain("low_hourly_value");
    expect(out.map((i) => i.type)).not.toContain("long_low_price");
  });

  it("emits high_hourly_value when pph exceeds 140% of avg", () => {
    // pph 300 > 1.4*150 = 210
    const out = generateServiceInsights(
      svc({ durationMinutes: 30, price: 150 }),
      150,
      0,
    );
    expect(out.map((i) => i.type)).toContain("high_hourly_value");
  });

  it("emits no hourly insight when pph sits between the low/high thresholds", () => {
    // pph 150 == avg → neither low nor high
    const out = generateServiceInsights(
      svc({ durationMinutes: 60, price: 150 }),
      150,
      0,
    );
    const types = out.map((i) => i.type);
    expect(types).not.toContain("low_hourly_value");
    expect(types).not.toContain("high_hourly_value");
    expect(types).not.toContain("long_low_price");
  });

  it("emits no internal-comparison insight when business avg pph is 0", () => {
    const out = generateServiceInsights(svc({ durationMinutes: 120, price: 10 }), 0, 0);
    const types = out.map((i) => i.type);
    expect(types).not.toContain("low_hourly_value");
    expect(types).not.toContain("long_low_price");
  });
});

describe("generateServiceInsights — no deposit insight exists", () => {
  it("never emits a deposit-related insight, regardless of duration", () => {
    for (const durationMinutes of [45, 60, 90, 120]) {
      const out = generateServiceInsights(svc({ durationMinutes }), 0, 0);
      const types = out.map((i) => i.type as string);
      expect(types).not.toContain("no_deposit_long");
    }
  });
});

describe("generateServiceInsights — popular service (F)", () => {
  it("flags popular_service at 1.5x the avg completed bookings", () => {
    const out = generateServiceInsights(
      svc({ completedBookingCount: 15 }),
      0,
      10, // 1.5*10 = 15 threshold (inclusive)
    );
    expect(out.map((i) => i.type)).toContain("popular_service");
  });

  it("does not flag below the popular threshold", () => {
    const out = generateServiceInsights(svc({ completedBookingCount: 14 }), 0, 10);
    expect(out.map((i) => i.type)).not.toContain("popular_service");
  });

  it("does not flag when business avg is 0", () => {
    const out = generateServiceInsights(svc({ completedBookingCount: 5 }), 0, 0);
    expect(out.map((i) => i.type)).not.toContain("popular_service");
  });
});

describe("generateServiceInsights — every insight has Hebrew title + body", () => {
  it("returns populated Hebrew strings for a service hitting several rules", () => {
    const out = generateServiceInsights(
      svc({
        durationMinutes: 120,
        price: 100,
        completedBookingCount: 20,
        marketMinPrice: 150,
        marketMaxPrice: 250,
      }),
      150,
      10,
    );
    expect(out.length).toBeGreaterThan(1);
    for (const i of out) {
      expect(i.title.length).toBeGreaterThan(0);
      expect(i.body.length).toBeGreaterThan(0);
      expect(i.title).toMatch(/[֐-׿]/);
      expect(["warning", "info", "positive"]).toContain(i.severity);
    }
  });
});

describe("hasPricingConcerns", () => {
  it("returns true when any service has a concerning insight", () => {
    const services = [
      svc({ durationMinutes: 60, price: 60 }), // low_hourly_value
    ];
    expect(hasPricingConcerns(services, 150, 0)).toBe(true);
  });

  it("returns false when no concerning insights exist", () => {
    const services = [svc({ durationMinutes: 30, price: 150 })]; // high pph, no concern
    expect(hasPricingConcerns(services, 150, 0)).toBe(false);
  });

  it("returns false for an empty service list", () => {
    expect(hasPricingConcerns([], 150, 10)).toBe(false);
  });

  it("treats below_range as a concern", () => {
    const services = [
      svc({ price: 50, marketMinPrice: 150, marketMaxPrice: 250, durationMinutes: 30 }),
    ];
    expect(hasPricingConcerns(services, 0, 0)).toBe(true);
  });

  it("does not treat above_range / within_range as a concern", () => {
    const services = [
      svc({ price: 300, marketMinPrice: 150, marketMaxPrice: 250, durationMinutes: 30 }),
    ];
    expect(hasPricingConcerns(services, 0, 0)).toBe(false);
  });
});
