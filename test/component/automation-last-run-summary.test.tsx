// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutomationLastRunSummary } from "@/components/automations/automation-last-run-summary";
import type { LastRunSummary } from "@/server/automations/run-queries";

function makeRun(over: Partial<LastRunSummary> = {}): LastRunSummary {
  return {
    startedAt: new Date(),
    sentCount: 3,
    failedCount: 0,
    skippedCount: 0,
    skippedReasons: [],
    ...over,
  } as LastRunSummary;
}

describe("AutomationLastRunSummary", () => {
  it("renders nothing when lastRun is null", () => {
    const { container } = render(<AutomationLastRunSummary lastRun={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows sent count and 'היום' timestamp for a run earlier today", () => {
    const today = new Date();
    today.setHours(today.getHours() > 0 ? today.getHours() - 1 : 0, 0, 0, 0);
    render(<AutomationLastRunSummary lastRun={makeRun({ startedAt: today, sentCount: 5 })} />);
    expect(screen.getByText(/נשלחו: 5/)).toBeInTheDocument();
    expect(screen.getByText(/הרצה אחרונה: היום/)).toBeInTheDocument();
  });

  it("labels a run from yesterday with 'אתמול'", () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    render(<AutomationLastRunSummary lastRun={makeRun({ startedAt: y })} />);
    expect(screen.getByText(/הרצה אחרונה: אתמול/)).toBeInTheDocument();
  });

  it("labels an older run with a full date", () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    render(<AutomationLastRunSummary lastRun={makeRun({ startedAt: old })} />);
    expect(screen.queryByText(/היום|אתמול/)).not.toBeInTheDocument();
    expect(screen.getByText(/הרצה אחרונה:/)).toBeInTheDocument();
  });

  it("shows failed count and combines failed+skipped into 'לא נשלחו'", () => {
    render(
      <AutomationLastRunSummary
        lastRun={makeRun({ sentCount: 1, failedCount: 2, skippedCount: 3 })}
      />,
    );
    expect(screen.getByText(/לא נשלחו: 5/)).toBeInTheDocument();
    expect(screen.getByText(/נכשלו: 2/)).toBeInTheDocument();
  });

  it("does not show the reasons toggle when there are no skipped reasons", () => {
    render(
      <AutomationLastRunSummary
        lastRun={makeRun({ sentCount: 1, failedCount: 1, skippedReasons: [] })}
      />,
    );
    expect(screen.queryByText("למה חלק לא קיבלו?")).not.toBeInTheDocument();
  });

  it("expands and collapses the skipped-reason breakdown", async () => {
    const user = userEvent.setup();
    render(
      <AutomationLastRunSummary
        lastRun={makeRun({
          sentCount: 0,
          failedCount: 0,
          skippedCount: 4,
          skippedReasons: [
            { reason: "אין מספר טלפון", count: 3 },
            { reason: "בתקופת המתנה", count: 1 },
          ],
        })}
      />,
    );

    const toggle = screen.getByText("למה חלק לא קיבלו?");
    // Collapsed initially.
    expect(screen.queryByText("אין מספר טלפון")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText("אין מספר טלפון")).toBeInTheDocument();
    expect(screen.getByText("בתקופת המתנה")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText("אין מספר טלפון")).not.toBeInTheDocument();
  });
});
