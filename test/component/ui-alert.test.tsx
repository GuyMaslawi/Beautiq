// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "@/components/ui/alert";

describe("Alert", () => {
  it("renders error variant by default with role=alert", () => {
    render(<Alert>שגיאה כללית</Alert>);
    const el = screen.getByRole("alert");
    expect(el).toHaveTextContent("שגיאה כללית");
    expect(el.className).toContain("text-red-700");
  });

  it("renders success variant styles", () => {
    render(<Alert variant="success">נשמר בהצלחה</Alert>);
    expect(screen.getByRole("alert").className).toContain("text-green-700");
  });

  it("merges a custom className", () => {
    render(
      <Alert variant="error" className="custom-x">
        x
      </Alert>,
    );
    expect(screen.getByRole("alert").className).toContain("custom-x");
  });
});
