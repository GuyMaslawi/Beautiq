// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessStepState } from "@/server/business/actions";

const m = vi.hoisted(() => ({ createBusinessAction: vi.fn() }));
vi.mock("@/server/business/actions", () => ({
  createBusinessAction: m.createBusinessAction,
}));
vi.mock("@/components/ui/animate", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => children,
}));

import { BusinessSetupCard } from "@/components/dashboard/business-setup-card";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BusinessSetupCard", () => {
  it("renders the welcome heading and the name field", () => {
    render(<BusinessSetupCard />);
    expect(screen.getByLabelText(/שם/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("submits the business name to the action", async () => {
    m.createBusinessAction.mockImplementation(
      async (_p: BusinessStepState, fd: FormData): Promise<BusinessStepState> => {
        expect(fd.get("name")).toBe("הסטודיו של יעל");
        return {};
      },
    );
    const user = userEvent.setup();
    render(<BusinessSetupCard />);
    await user.type(screen.getByLabelText(/שם/), "הסטודיו של יעל");
    await user.click(screen.getByRole("button"));
    expect(m.createBusinessAction).toHaveBeenCalled();
  });

  it("shows a form error returned by the action", async () => {
    m.createBusinessAction.mockResolvedValue({ formError: "משהו השתבש" } satisfies BusinessStepState);
    const user = userEvent.setup();
    render(<BusinessSetupCard />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("משהו השתבש")).toBeInTheDocument();
  });

  it("shows a field error returned by the action", async () => {
    m.createBusinessAction.mockResolvedValue({
      errors: { name: "יש להזין שם" },
    } satisfies BusinessStepState);
    const user = userEvent.setup();
    render(<BusinessSetupCard />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("יש להזין שם")).toBeInTheDocument();
  });

  it("redirects to the dashboard when the business is created", async () => {
    const replace = vi.fn();
    Object.defineProperty(window, "location", {
      value: { replace },
      configurable: true,
      writable: true,
    });
    m.createBusinessAction.mockResolvedValue({ created: true } satisfies BusinessStepState);
    const user = userEvent.setup();
    render(<BusinessSetupCard />);
    await user.click(screen.getByRole("button"));
    // The effect fires after state update.
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });
});
