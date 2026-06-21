// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ScrollReset } from "@/components/layout/scroll-reset";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

beforeEach(() => vi.clearAllMocks());

describe("ScrollReset", () => {
  it("scrolls the target container to the top on mount", () => {
    const scrollTo = vi.fn();
    const el = document.createElement("div");
    el.id = "main-scroll";
    el.scrollTo = scrollTo as unknown as typeof el.scrollTo;
    document.body.appendChild(el);

    const { container } = render(<ScrollReset containerId="main-scroll" />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
    // renders nothing
    expect(container.firstChild).toBeNull();
    document.body.removeChild(el);
  });

  it("does not throw when the container is missing", () => {
    expect(() =>
      render(<ScrollReset containerId="does-not-exist" />),
    ).not.toThrow();
  });
});
