// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientAuraCard } from "@/components/premium/client-aura-card";

describe("ClientAuraCard", () => {
  it("renders name and initials without a link", () => {
    render(<ClientAuraCard name="נועה" initials="נ" />);
    expect(screen.getByText("נועה")).toBeInTheDocument();
    expect(screen.getByText("נ")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders contact, status pill, badges, stats, highlight, actions and link", () => {
    render(
      <ClientAuraCard
        name="דנה"
        contact="050-1234567"
        initials="ד"
        href="/clients/1"
        statusTone="success"
        statusLabel="פעילה"
        statusDot
        badges={<span>תגית</span>}
        stats={[
          { label: "ביקורים", value: 5 },
          { label: "הכנסה", value: "₪900" },
        ]}
        highlight={<span>תור קרוב</span>}
        actions={<button>הודעה</button>}
      />,
    );
    expect(screen.getByText("050-1234567")).toBeInTheDocument();
    expect(screen.getByText("פעילה")).toBeInTheDocument();
    expect(screen.getByText("תגית")).toBeInTheDocument();
    expect(screen.getByText("ביקורים")).toBeInTheDocument();
    expect(screen.getByText("תור קרוב")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הודעה" })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/clients/1");
  });
});
