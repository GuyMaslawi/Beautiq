// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { BookingSearchInput } from "@/components/bookings/booking-search-input";

const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("BookingSearchInput", () => {
  it("renders the Hebrew placeholder and the initial value", () => {
    render(<BookingSearchInput initialValue="נועה" otherParams="filter=all" />);
    const input = screen.getByPlaceholderText(
      "חיפוש לפי שם לקוחה או טלפון...",
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("נועה");
    expect(input).toHaveAttribute("dir", "rtl");
  });

  it("debounces and pushes a URL that adds the trimmed q param", () => {
    render(<BookingSearchInput initialValue="" otherParams="filter=week" />);
    const input = screen.getByPlaceholderText(
      "חיפוש לפי שם לקוחה או טלפון...",
    );

    act(() => {
      fireEvent.change(input, { target: { value: "  דנה  " } });
    });

    // Not pushed before the debounce elapses.
    m.push.mockClear();
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(m.push).toHaveBeenCalled();
    const url = m.push.mock.calls.at(-1)![0] as string;
    expect(url).toContain("filter=week");
    expect(url).toContain("q=");
    // trimmed "דנה" (URL-encoded), not the raw spaced value
    expect(url).toContain(encodeURIComponent("דנה"));
  });

  it("removes the q param when the value is cleared", () => {
    render(<BookingSearchInput initialValue="נועה" otherParams="filter=all" />);
    const input = screen.getByPlaceholderText(
      "חיפוש לפי שם לקוחה או טלפון...",
    );

    act(() => {
      fireEvent.change(input, { target: { value: "" } });
    });

    m.push.mockClear();
    act(() => {
      vi.advanceTimersByTime(420);
    });
    const url = m.push.mock.calls.at(-1)![0] as string;
    expect(url).not.toContain("q=");
    expect(url).toContain("filter=all");
  });
});
