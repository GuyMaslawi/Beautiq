// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toaster } from "@/components/ui/sonner";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));

describe("Toaster (sonner wrapper)", () => {
  it("renders the notifications region", () => {
    render(<Toaster />);
    expect(
      screen.getByRole("region", { name: /Notifications/i }),
    ).toBeInTheDocument();
  });

  it("forwards extra props (e.g. position) without crashing", () => {
    render(<Toaster position="top-center" />);
    expect(
      screen.getByRole("region", { name: /Notifications/i }),
    ).toBeInTheDocument();
  });
});
