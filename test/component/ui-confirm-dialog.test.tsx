// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIM = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "layout",
    "variants",
  ]);
  const strip = (p: Record<string, unknown>) => {
    const r: Record<string, unknown> = {};
    for (const k in p) if (!ANIM.has(k)) r[k] = p[k];
    return React.createElement("div", r);
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: () => strip }),
  };
});

beforeEach(() => vi.clearAllMocks());

const base = {
  title: "לבטל את התור?",
  confirmLabel: "כן, בטל",
  cancelLabel: "חזרה",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByText("לבטל את התור?")).not.toBeInTheDocument();
  });

  it("renders title, description and buttons when open", () => {
    render(
      <ConfirmDialog {...base} open description="הלקוחה תקבל הודעה" />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("לבטל את התור?")).toBeInTheDocument();
    expect(screen.getByText("הלקוחה תקבל הודעה")).toBeInTheDocument();
    expect(screen.getByText("כן, בטל")).toBeInTheDocument();
    expect(screen.getByText("חזרה")).toBeInTheDocument();
  });

  it("calls onConfirm and onCancel from buttons", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog {...base} open onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByText("כן, בטל"));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByText("חזרה"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when clicking the backdrop", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open onCancel={onCancel} />);
    await userEvent.click(
      document.querySelector('[aria-hidden="true"]') as HTMLElement,
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel on Escape key", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open onCancel={onCancel} />);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders destructive confirm and disables buttons while pending", () => {
    render(<ConfirmDialog {...base} open destructive pending />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((b) => expect(b).toBeDisabled());
  });
});
