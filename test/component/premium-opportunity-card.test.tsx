// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GrowthOpportunityCard } from "@/components/premium/opportunity-card";

describe("GrowthOpportunityCard", () => {
  it("renders name, initials and reason (minimal)", () => {
    render(
      <GrowthOpportunityCard
        name="נועה"
        initials="נ"
        reason="לא חזרה כבר חודשיים"
      />,
    );
    expect(screen.getByText("נועה")).toBeInTheDocument();
    expect(screen.getByText("לא חזרה כבר חודשיים")).toBeInTheDocument();
  });

  it("renders value, segment, meta, actions", () => {
    render(
      <GrowthOpportunityCard
        name="דנה"
        initials="ד"
        reason="r"
        value="₪180"
        segment="VIP"
        segmentTone="gold"
        meta={<span>מטא</span>}
        actions={<button>שלח הודעה</button>}
      />,
    );
    expect(screen.getByText("₪180")).toBeInTheDocument();
    expect(screen.getByText("פוטנציאל")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("מטא")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "שלח הודעה" }),
    ).toBeInTheDocument();
  });

  it("renders expanded content only when open", () => {
    const { rerender } = render(
      <GrowthOpportunityCard
        name="x"
        initials="x"
        reason="r"
        expanded={<div>מחבר הודעה</div>}
      />,
    );
    expect(screen.queryByText("מחבר הודעה")).not.toBeInTheDocument();
    rerender(
      <GrowthOpportunityCard
        name="x"
        initials="x"
        reason="r"
        open
        expanded={<div>מחבר הודעה</div>}
      />,
    );
    expect(screen.getByText("מחבר הודעה")).toBeInTheDocument();
  });
});
