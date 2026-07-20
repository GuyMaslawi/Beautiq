// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingAdvancedFilter } from "@/components/bookings/booking-advanced-filter";

const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIM = new Set(["initial", "animate", "exit", "transition"]);
  const strip = (props: Record<string, unknown>) => {
    const rest: Record<string, unknown> = {};
    for (const k in props) if (!ANIM.has(k)) rest[k] = props[k];
    return React.createElement("div", rest);
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: () => strip }),
  };
});

const SERVICES = [
  { id: "s1", name: "מניקור" },
  { id: "s2", name: "פדיקור" },
];

function renderFilter(props: Partial<React.ComponentProps<typeof BookingAdvancedFilter>> = {}) {
  return render(
    <BookingAdvancedFilter
      services={SERVICES}
      currentStatus="all"
      currentServiceId={undefined}
      baseParams="filter=all"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingAdvancedFilter — trigger + count", () => {
  it("renders the trigger with no active-count badge by default", () => {
    renderFilter();
    expect(screen.getByText("סינון מתקדם")).toBeInTheDocument();
  });

  it("shows the active filter count badge when status + service are set", () => {
    renderFilter({ currentStatus: "completed", currentServiceId: "s1" });
    // 2 active filters
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("BookingAdvancedFilter — popover", () => {
  it("opens the popover and lists status + service pills", async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByText("סינון מתקדם"));

    expect(screen.getByText("סטטוס תור")).toBeInTheDocument();
    expect(screen.getByText("שירות")).toBeInTheDocument();
    expect(screen.getByText("פעילים")).toBeInTheDocument();
    expect(screen.getByText("מניקור")).toBeInTheDocument();
  });

  it("navigates with a status param when a status pill is chosen", async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByText("סינון מתקדם"));
    await user.click(screen.getByText("הושלמו"));

    expect(m.push).toHaveBeenCalledTimes(1);
    const url = m.push.mock.calls[0][0] as string;
    expect(url).toContain("status=completed");
    expect(url).toContain("filter=all");
  });

  it("navigates with a serviceId param when a service pill is chosen", async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByText("סינון מתקדם"));
    await user.click(screen.getByText("פדיקור"));

    const url = m.push.mock.calls[0][0] as string;
    expect(url).toContain("serviceId=s2");
  });

  it("clears all advanced filters via the clear-all button", async () => {
    const user = userEvent.setup();
    renderFilter({ currentStatus: "completed", currentServiceId: "s1" });
    await user.click(screen.getByText("סינון מתקדם"));
    await user.click(screen.getByText("ניקוי כל הפילטרים"));

    const url = m.push.mock.calls[0][0] as string;
    expect(url).not.toContain("status=");
    expect(url).not.toContain("serviceId=");
  });

  it("closes the popover on Escape", async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByText("סינון מתקדם"));
    expect(screen.getByText("סטטוס תור")).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByText("סטטוס תור")).not.toBeInTheDocument();
  });

  it("closes the popover on outside click", async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByText("סינון מתקדם"));
    expect(screen.getByText("סטטוס תור")).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(screen.queryByText("סטטוס תור")).not.toBeInTheDocument();
  });

  it("omits the service section when there are no services", async () => {
    const user = userEvent.setup();
    renderFilter({ services: [] });
    await user.click(screen.getByText("סינון מתקדם"));
    expect(screen.queryByText("שירות")).not.toBeInTheDocument();
  });
});

describe("BookingAdvancedFilter — active chips", () => {
  it("renders chips for active status and service and clears via the chip's button", async () => {
    const user = userEvent.setup();
    renderFilter({ currentStatus: "completed", currentServiceId: "s1" });

    expect(screen.getByText("הושלמו")).toBeInTheDocument();
    expect(screen.getByText("מניקור")).toBeInTheDocument();

    await user.click(screen.getByLabelText("הסר פילטר: מניקור"));
    const url = m.push.mock.calls[0][0] as string;
    expect(url).not.toContain("serviceId=");
  });

  it("falls back to the serviceId as the chip label when the service is unknown", () => {
    renderFilter({ currentServiceId: "ghost-id" });
    expect(screen.getByText("ghost-id")).toBeInTheDocument();
  });
});
