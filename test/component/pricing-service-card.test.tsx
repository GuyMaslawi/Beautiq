// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// next/link → plain anchor so hrefs are inspectable.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...rest }, children),
}));

// Isolate the card from the real form (which needs a server action).
vi.mock("@/components/pricing/market-range-form", () => ({
  MarketRangeForm: (props: { serviceId: string }) =>
    React.createElement(
      "div",
      { "data-testid": "market-range-form" },
      props.serviceId,
    ),
}));

import React from "react";
import { PricingServiceCard } from "@/components/pricing/pricing-service-card";
import { PRICING } from "@/lib/constants/he";
import type { PricingServiceData } from "@/server/pricing/queries";
import type { PricingInsight } from "@/lib/pricing/insights";

function makeService(
  overrides: Partial<PricingServiceData> = {},
): PricingServiceData {
  return {
    id: "svc-1",
    name: "מניקור ג'ל",
    price: 150,
    durationMinutes: 60,
    pricePerHour: 150,
    isActive: true,
    completedBookingCount: 0,
    marketMinPrice: null,
    marketAveragePrice: null,
    marketMaxPrice: null,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("PricingServiceCard — header & metrics", () => {
  it("renders name, price, price-per-hour and an edit-service link", () => {
    render(<PricingServiceCard service={makeService()} insights={[]} />);
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText(PRICING.card.price)).toBeInTheDocument();
    expect(screen.getByText(PRICING.card.pricePerHour)).toBeInTheDocument();
    expect(screen.getAllByText("₪150").length).toBeGreaterThan(0);

    const link = screen.getByText(PRICING.card.editService).closest("a")!;
    expect(link.getAttribute("href")).toBe("/services/svc-1");
  });

  it("formats sub-hour and multi-hour durations in Hebrew", () => {
    const { rerender } = render(
      <PricingServiceCard
        service={makeService({ durationMinutes: 45 })}
        insights={[]}
      />,
    );
    expect(screen.getByText("45 דק׳")).toBeInTheDocument();

    rerender(
      <PricingServiceCard
        service={makeService({ durationMinutes: 60 })}
        insights={[]}
      />,
    );
    expect(screen.getByText("1 שעה")).toBeInTheDocument();

    rerender(
      <PricingServiceCard
        service={makeService({ durationMinutes: 90 })}
        insights={[]}
      />,
    );
    expect(screen.getByText("1:30 שעות")).toBeInTheDocument();
  });

  it("shows the completed-bookings line only when count > 0", () => {
    const { rerender } = render(
      <PricingServiceCard
        service={makeService({ completedBookingCount: 0 })}
        insights={[]}
      />,
    );
    expect(
      screen.queryByText(new RegExp(PRICING.card.completedBookings)),
    ).not.toBeInTheDocument();

    rerender(
      <PricingServiceCard
        service={makeService({ completedBookingCount: 12 })}
        insights={[]}
      />,
    );
    expect(
      screen.getByText(new RegExp(PRICING.card.completedBookings)),
    ).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("PricingServiceCard — inactive state", () => {
  it("shows the inactive badge and inactive note when not active", () => {
    render(
      <PricingServiceCard
        service={makeService({ isActive: false })}
        insights={[]}
      />,
    );
    expect(screen.getByText("לא פעיל")).toBeInTheDocument();
    expect(screen.getByText(PRICING.card.inactiveNote)).toBeInTheDocument();
  });

  it("shows the no-range placeholder for an active service without range or insights", () => {
    render(<PricingServiceCard service={makeService()} insights={[]} />);
    expect(screen.getByText(PRICING.card.noRange)).toBeInTheDocument();
  });
});

describe("PricingServiceCard — market range display", () => {
  it("renders all three range values when present", () => {
    render(
      <PricingServiceCard
        service={makeService({
          marketMinPrice: 100,
          marketAveragePrice: 180,
          marketMaxPrice: 260,
        })}
        insights={[]}
      />,
    );
    expect(screen.getByText(PRICING.marketRange.sectionTitle)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PRICING.card.rangeMin))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PRICING.card.rangeAvg))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PRICING.card.rangeMax))).toBeInTheDocument();
    expect(screen.getByText("₪100")).toBeInTheDocument();
    expect(screen.getByText("₪180")).toBeInTheDocument();
    expect(screen.getByText("₪260")).toBeInTheDocument();
    // no-range placeholder must NOT show when a range exists
    expect(screen.queryByText(PRICING.card.noRange)).not.toBeInTheDocument();
  });

  it("renders a partial range (only min set, no avg/max)", () => {
    render(
      <PricingServiceCard
        service={makeService({ marketMinPrice: 90 })}
        insights={[]}
      />,
    );
    expect(screen.getByText(new RegExp(PRICING.card.rangeMin))).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(PRICING.card.rangeAvg)),
    ).not.toBeInTheDocument();
  });
});

describe("PricingServiceCard — insight chips", () => {
  const insights: PricingInsight[] = [
    { type: "below_range", title: "כותרת אזהרה", body: "גוף אזהרה", severity: "warning" },
    { type: "within_range", title: "כותרת חיובית", body: "גוף חיובי", severity: "positive" },
    { type: "above_range", title: "כותרת מידע", body: "גוף מידע", severity: "info" },
  ];

  it("renders each severity chip with its title and body", () => {
    render(<PricingServiceCard service={makeService()} insights={insights} />);
    for (const i of insights) {
      expect(screen.getByText(i.title)).toBeInTheDocument();
      expect(screen.getByText(i.body)).toBeInTheDocument();
    }
    // insights present → no-range placeholder suppressed even without a range
    expect(screen.queryByText(PRICING.card.noRange)).not.toBeInTheDocument();
  });
});

describe("PricingServiceCard — collapsible range form", () => {
  it("toggles the market-range form open and closed", async () => {
    render(<PricingServiceCard service={makeService()} insights={[]} />);
    expect(screen.queryByTestId("market-range-form")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(PRICING.card.editRange) }),
    );
    expect(screen.getByTestId("market-range-form")).toBeInTheDocument();
    // optional label appears in the open panel
    expect(
      screen.getByText(new RegExp(PRICING.marketRange.sectionOptional)),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(PRICING.card.cancelEdit) }),
    );
    expect(screen.queryByTestId("market-range-form")).not.toBeInTheDocument();
  });
});
