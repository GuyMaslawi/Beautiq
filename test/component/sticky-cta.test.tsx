// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { StickyBookingCta } from "@/app/b/[slug]/_components/sticky-cta";

// IntersectionObserver is not implemented in jsdom — provide a controllable stub.
let lastObserverCallback: ((entries: { isIntersecting: boolean }[]) => void) | null =
  null;

class MockIntersectionObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    lastObserverCallback = cb;
  }
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

beforeEach(() => {
  lastObserverCallback = null;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver as never);
});

describe("StickyBookingCta", () => {
  it("renders the Hebrew CTA label", () => {
    document.body.innerHTML = '<div id="book" tabindex="-1"></div>';
    render(<StickyBookingCta brand="#b86b8c" />);
    expect(
      screen.getByRole("button", { name: /קביעת תור עכשיו/ }),
    ).toBeInTheDocument();
  });

  it("starts hidden and becomes visible when the booking card leaves the viewport", () => {
    document.body.innerHTML = '<div id="book" tabindex="-1"></div>';
    const { container } = render(<StickyBookingCta brand="#b86b8c" />);
    const wrapper = container.firstChild as HTMLElement;

    // Initially hidden (translate-y-full / opacity-0).
    expect(wrapper.className).toContain("opacity-0");

    // Booking card scrolls out of view → CTA appears.
    act(() => lastObserverCallback?.([{ isIntersecting: false }]));
    expect(wrapper.className).toContain("opacity-100");

    // Booking card back in view → CTA hides again.
    act(() => lastObserverCallback?.([{ isIntersecting: true }]));
    expect(wrapper.className).toContain("opacity-0");
  });

  it("scrolls to and focuses the booking card when tapped", async () => {
    document.body.innerHTML = '<div id="book" tabindex="-1"></div>';
    const target = document.getElementById("book")!;
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    target.scrollIntoView = scrollSpy;
    target.focus = focusSpy;

    vi.useFakeTimers();
    render(<StickyBookingCta brand="#b86b8c" />);
    // Reveal the button so it's interactive.
    act(() => lastObserverCallback?.([{ isIntersecting: false }]));

    const btn = screen.getByRole("button", { name: /קביעת תור עכשיו/ });
    act(() => btn.click());

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    vi.advanceTimersByTime(400);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    vi.useRealTimers();
  });

  it("does not crash when the #book anchor is missing", () => {
    document.body.innerHTML = "";
    expect(() => render(<StickyBookingCta brand="#b86b8c" />)).not.toThrow();
  });
});
