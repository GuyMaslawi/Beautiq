// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({ resolveTemplate: vi.fn() }));
vi.mock("@/server/messages/queries", () => ({
  resolveTemplate: m.resolveTemplate,
}));

import { ClientMessagesCard } from "@/components/messages/client-messages-card";

beforeEach(() => {
  vi.clearAllMocks();
});

const tenant = { businessId: "biz-1" } as never;

describe("ClientMessagesCard (async server component)", () => {
  it("renders rebook + after-treatment messages using the recent booking", async () => {
    m.resolveTemplate.mockImplementation((_t: unknown, type: string) => {
      if (type === "rebook_reminder")
        return Promise.resolve("היי {clientName}, עבר זמן מאז התור אצל {businessName}.");
      if (type === "after_treatment")
        return Promise.resolve("תודה {clientName} על הטיפול {serviceName}.");
      return Promise.resolve(null);
    });

    const ui = await ClientMessagesCard({
      tenant,
      clientName: "מיכל",
      businessName: "סטודיו יופי",
      recentBooking: { serviceName: "לק ג׳ל", startTime: new Date("2026-06-12T07:30:00Z") },
    });
    render(ui);

    expect(screen.getByText("הודעות מהירות")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הודעה לקביעת תור חוזר" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הודעה אחרי טיפול" })).toBeInTheDocument();
  });

  it("renders only the rebook message when there is no recent booking", async () => {
    m.resolveTemplate.mockImplementation((_t: unknown, type: string) =>
      type === "rebook_reminder"
        ? Promise.resolve("היי {clientName}, מתגעגעים ב{businessName}.")
        : Promise.resolve(null),
    );

    const ui = await ClientMessagesCard({
      tenant,
      clientName: "מיכל",
      businessName: "סטודיו יופי",
      recentBooking: null,
    });
    render(ui);
    expect(screen.getByRole("button", { name: "הודעה לקביעת תור חוזר" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "הודעה אחרי טיפול" })).not.toBeInTheDocument();
  });

  it("returns null when no template resolves", async () => {
    m.resolveTemplate.mockResolvedValue(null);
    const ui = await ClientMessagesCard({
      tenant,
      clientName: "מיכל",
      businessName: "סטודיו יופי",
    });
    expect(ui).toBeNull();
  });
});
