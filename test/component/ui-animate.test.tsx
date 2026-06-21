// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FadeIn, StaggerIn, Reveal, StaggerItem } from "@/components/ui/animate";

const reducedRef = { value: false };

vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIM = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "whileInView",
    "viewport",
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
    useReducedMotion: () => reducedRef.value,
  };
});

describe("animate primitives", () => {
  it("FadeIn renders children and forwards props/className", () => {
    render(
      <FadeIn delay={0.1} duration={0.3} y={20} className="fade-x" data-testid="fade">
        תוכן
      </FadeIn>,
    );
    expect(screen.getByText("תוכן")).toBeInTheDocument();
    expect(screen.getByTestId("fade")).toHaveClass("fade-x");
  });

  it("StaggerIn renders children", () => {
    render(
      <StaggerIn stagger={0.05} delay={0.1} className="stag">
        <span>פריט</span>
      </StaggerIn>,
    );
    expect(screen.getByText("פריט")).toBeInTheDocument();
  });

  it("StaggerItem renders children", () => {
    render(<StaggerItem className="item">תא</StaggerItem>);
    expect(screen.getByText("תא")).toBeInTheDocument();
  });

  it("Reveal renders motion wrapper when motion is allowed", () => {
    reducedRef.value = false;
    render(
      <Reveal delay={0.2} y={10} duration={0.4} className="rev">
        חשיפה
      </Reveal>,
    );
    expect(screen.getByText("חשיפה")).toBeInTheDocument();
  });

  it("Reveal renders plain div when reduced motion is requested", () => {
    reducedRef.value = true;
    render(<Reveal className="rev-reduced">מיידי</Reveal>);
    const el = screen.getByText("מיידי");
    expect(el).toHaveClass("rev-reduced");
    reducedRef.value = false;
  });
});
