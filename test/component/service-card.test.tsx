// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceCard } from "@/components/services/service-card";
import { SERVICES } from "@/lib/constants/he";
import { Prisma } from "@prisma/client";
import React from "react";

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
vi.mock("@/server/services/actions", () => ({
  toggleServiceActiveAction: vi.fn(async () => ({ success: true })),
}));

function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "לק ג'ל",
    description: "מניקור מלא",
    durationMinutes: 60,
    price: new Prisma.Decimal(180),
    isActive: true,
    ...overrides,
  } as React.ComponentProps<typeof ServiceCard>["service"];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ServiceCard", () => {
  it("renders the service name, description, price and edit link", () => {
    render(<ServiceCard service={makeService()} />);
    expect(screen.getByText("לק ג'ל")).toBeInTheDocument();
    expect(screen.getByText("מניקור מלא")).toBeInTheDocument();
    expect(screen.getByText("₪180")).toBeInTheDocument();

    const editLink = screen.getByText(SERVICES.card.editButton).closest("a")!;
    expect(editLink.getAttribute("href")).toBe("/services/s1");
  });

  it.each([
    [60, "שעה"],
    [90, "שעה וחצי"],
    [30, "30 דק׳"],
    [120, "שעתיים"],
    [45, "45 דק׳"],
    [15, "15 דק׳"],
    [75, "שעה ורבע"],
    [150, "שעתיים וחצי"],
    [180, "שלוש שעות"],
    [25, "25 דק׳"],
  ])("formats %i minutes as '%s'", (minutes, label) => {
    render(<ServiceCard service={makeService({ durationMinutes: minutes })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders the toggle in its active state for an active service", () => {
    render(<ServiceCard service={makeService({ isActive: true })} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("marks the card inactive for an inactive service", () => {
    render(<ServiceCard service={makeService({ isActive: false })} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("shows the pricing badge linking to the service when provided", () => {
    render(
      <ServiceCard service={makeService()} pricingBadge="מחיר נמוך לשעה" />,
    );
    const badge = screen.getByText("מחיר נמוך לשעה").closest("a")!;
    expect(badge.getAttribute("href")).toBe("/services/s1");
  });

  it("omits the pricing badge when none is provided", () => {
    render(<ServiceCard service={makeService()} />);
    expect(screen.queryByText("מחיר נמוך לשעה")).not.toBeInTheDocument();
  });

  it("handles a null description gracefully", () => {
    render(<ServiceCard service={makeService({ description: null })} />);
    expect(screen.getByText("לק ג'ל")).toBeInTheDocument();
  });
});
