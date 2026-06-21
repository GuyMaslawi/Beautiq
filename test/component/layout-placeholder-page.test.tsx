// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

describe("PlaceholderPage", () => {
  it("renders the title, message and the 'בקרוב' badge", () => {
    render(<PlaceholderPage title="בקרוב מאוד" message="עמוד זה בבנייה" />);
    expect(
      screen.getByRole("heading", { name: "בקרוב מאוד" }),
    ).toBeInTheDocument();
    expect(screen.getByText("עמוד זה בבנייה")).toBeInTheDocument();
    expect(screen.getByText("בקרוב")).toBeInTheDocument();
  });
});
