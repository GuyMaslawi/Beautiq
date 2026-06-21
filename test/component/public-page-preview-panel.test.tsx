// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PublicPagePreviewPanel } from "@/components/public-page/public-page-preview-panel";

beforeEach(() => vi.clearAllMocks());

describe("PublicPagePreviewPanel", () => {
  it("renders the mobile iframe by default", () => {
    render(<PublicPagePreviewPanel slug="studio-yofi" />);
    expect(
      screen.getByText(/כך הלקוחות רואים את העמוד שלך/),
    ).toBeInTheDocument();
    const iframe = screen.getByTitle(
      "תצוגה מקדימה של עמוד לקוחות — מובייל",
    ) as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe("/b/studio-yofi");
  });

  it("switches to the desktop frame and back to mobile", async () => {
    render(<PublicPagePreviewPanel slug="studio-yofi" />);
    await userEvent.click(screen.getByRole("button", { name: /דסקטופ/ }));
    expect(
      screen.getByTitle("תצוגה מקדימה של עמוד לקוחות — דסקטופ"),
    ).toBeInTheDocument();
    // desktop chrome shows the full URL
    expect(
      screen.getByText(`${window.location.origin}/b/studio-yofi`),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /מובייל/ }));
    expect(
      screen.getByTitle("תצוגה מקדימה של עמוד לקוחות — מובייל"),
    ).toBeInTheDocument();
  });

  it("reloads the iframe (remounts via key change) on refresh", async () => {
    render(<PublicPagePreviewPanel slug="studio-yofi" />);
    const before = screen.getByTitle(
      "תצוגה מקדימה של עמוד לקוחות — מובייל",
    );
    await userEvent.click(screen.getByRole("button", { name: "רענון" }));
    const after = screen.getByTitle("תצוגה מקדימה של עמוד לקוחות — מובייל");
    // the element is a freshly mounted node after the key bump
    expect(after).not.toBe(before);
  });
});
