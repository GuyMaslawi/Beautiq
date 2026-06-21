// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServicePricingHealth } from "@/components/services/service-pricing-health";
import { PRICING } from "@/lib/constants/he";
import type { PricingServiceData } from "@/server/pricing/queries";
import type { PricingInsight } from "@/lib/pricing/insights";

// Stub the heavy MarketRangeForm child (its own server action is out of scope).
vi.mock("@/components/pricing/market-range-form", () => ({
  MarketRangeForm: () => <div data-testid="market-range-form" />,
}));

function makeService(overrides: Partial<PricingServiceData> = {}): PricingServiceData {
  return {
    id: "s1",
    name: "לק ג'ל",
    price: 180,
    durationMinutes: 60,
    pricePerHour: 180,
    isActive: true,
    completedBookingCount: 4,
    marketMinPrice: null,
    marketAveragePrice: null,
    marketMaxPrice: null,
    ...overrides,
  };
}

const WARNING_INSIGHT: PricingInsight = {
  type: "low_hourly_value",
  title: "מחיר נמוך יחסית לשעה",
  body: "השירות הזה מכניס פחות לשעה.",
  severity: "warning",
};
const POSITIVE_INSIGHT: PricingInsight = {
  type: "high_hourly_value",
  title: "מחיר גבוה יחסית לשעה",
  body: "מכניס יותר לשעה.",
  severity: "positive",
};
const INFO_INSIGHT: PricingInsight = {
  type: "popular_service",
  title: "שירות מבוקש",
  body: "אחד המבוקשים.",
  severity: "info",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ServicePricingHealth — header + price metrics", () => {
  it("renders the title and price-per-hour", () => {
    render(
      <ServicePricingHealth
        service={makeService()}
        insights={[]}
        businessAvgPricePerHour={200}
      />,
    );
    expect(screen.getByText("בריאות תמחור")).toBeInTheDocument();
    expect(screen.getByText("₪180")).toBeInTheDocument();
    expect(screen.getByText("₪200")).toBeInTheDocument();
  });

  it("shows the relative percentage vs business average", () => {
    render(
      <ServicePricingHealth
        service={makeService({ pricePerHour: 150 })}
        insights={[]}
        businessAvgPricePerHour={300}
      />,
    );
    // 150/300 = 50%
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("shows an em-dash for the average and no rel% when business average is 0", () => {
    render(
      <ServicePricingHealth
        service={makeService()}
        insights={[]}
        businessAvgPricePerHour={0}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    // No relative-percentage column when there is no business average.
    expect(screen.queryByText("ביחס לממוצע")).not.toBeInTheDocument();
  });
});

describe("ServicePricingHealth — market range", () => {
  it("renders the market range section when min/avg/max are set", () => {
    render(
      <ServicePricingHealth
        service={makeService({
          marketMinPrice: 150,
          marketAveragePrice: 200,
          marketMaxPrice: 280,
        })}
        insights={[]}
        businessAvgPricePerHour={200}
      />,
    );
    expect(screen.getByText(PRICING.marketRange.sectionTitle)).toBeInTheDocument();
    expect(screen.getByText("₪150")).toBeInTheDocument();
    expect(screen.getByText("₪280")).toBeInTheDocument();
  });

  it("shows the no-range hint when there is no market range and no insights", () => {
    render(
      <ServicePricingHealth
        service={makeService()}
        insights={[]}
        businessAvgPricePerHour={200}
      />,
    );
    expect(screen.getByText(PRICING.card.noRange)).toBeInTheDocument();
  });
});

describe("ServicePricingHealth — insights chips", () => {
  it("renders warning, positive and info insight chips", () => {
    render(
      <ServicePricingHealth
        service={makeService()}
        insights={[WARNING_INSIGHT, POSITIVE_INSIGHT, INFO_INSIGHT]}
        businessAvgPricePerHour={200}
      />,
    );
    expect(screen.getByText(WARNING_INSIGHT.title)).toBeInTheDocument();
    expect(screen.getByText(POSITIVE_INSIGHT.title)).toBeInTheDocument();
    expect(screen.getByText(INFO_INSIGHT.title)).toBeInTheDocument();
    expect(screen.getByText(WARNING_INSIGHT.body)).toBeInTheDocument();
    // No "no range" hint when insights exist.
    expect(screen.queryByText(PRICING.card.noRange)).not.toBeInTheDocument();
  });
});

describe("ServicePricingHealth — edit range toggle", () => {
  it("expands the market-range form and toggles the button label", async () => {
    const user = userEvent.setup();
    render(
      <ServicePricingHealth
        service={makeService()}
        insights={[]}
        businessAvgPricePerHour={200}
      />,
    );

    expect(screen.queryByTestId("market-range-form")).not.toBeInTheDocument();
    expect(screen.getByText(PRICING.card.editRange)).toBeInTheDocument();

    await user.click(screen.getByText(PRICING.card.editRange));
    expect(screen.getByTestId("market-range-form")).toBeInTheDocument();
    expect(screen.getByText(PRICING.card.cancelEdit)).toBeInTheDocument();

    await user.click(screen.getByText(PRICING.card.cancelEdit));
    expect(screen.queryByTestId("market-range-form")).not.toBeInTheDocument();
  });
});
