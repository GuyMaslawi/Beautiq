// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

import { AuthShell } from "@/components/auth/auth-shell";
import { BRAND } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthShell", () => {
  it("renders its children inside the form panel", () => {
    render(
      <AuthShell>
        <div data-testid="child">תוכן הטופס</div>
      </AuthShell>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("תוכן הטופס")).toBeInTheDocument();
  });

  it("renders the brand mark and tagline", () => {
    render(
      <AuthShell>
        <div />
      </AuthShell>,
    );
    // BRAND.name ("Allura") appears both in the form mark and the preview sidebar.
    expect(screen.getAllByText(BRAND.name).length).toBeGreaterThan(0);
    expect(screen.getByText("ה-CRM לעסקי יופי")).toBeInTheDocument();
  });

  it("renders the marketing headline and Hebrew social proof copy", () => {
    render(
      <AuthShell>
        <div />
      </AuthShell>,
    );
    expect(screen.getByText("פלטפורמה חכמה לעסקי יופי")).toBeInTheDocument();
    expect(screen.getByText("פחות ביטולים.")).toBeInTheDocument();
    expect(screen.getByText("יותר לקוחות חוזרות.")).toBeInTheDocument();
    expect(
      screen.getByText("אהוב על בעלות עסקי יופי בישראל"),
    ).toBeInTheDocument();
  });

  it("renders the preview nav groups, metrics and bookings", () => {
    render(
      <AuthShell>
        <div />
      </AuthShell>,
    );
    // Nav group labels.
    expect(screen.getByText("ניהול יומי")).toBeInTheDocument();
    expect(screen.getByText("העסק")).toBeInTheDocument();
    expect(screen.getByText("הגדלת הכנסות")).toBeInTheDocument();
    // A metric.
    expect(screen.getByText("לקוחות פעילים")).toBeInTheDocument();
    // A booking preview row.
    expect(screen.getByText("נועה לוי")).toBeInTheDocument();
    expect(screen.getByText("מיה כהן")).toBeInTheDocument();
  });

  it("renders the trust pills (form + preview)", () => {
    render(
      <AuthShell>
        <div />
      </AuthShell>,
    );
    // Appears in both form pills and preview list copy.
    expect(screen.getAllByText("עברית מלאה").length).toBeGreaterThan(0);
    expect(screen.getByText("CRM מובנה")).toBeInTheDocument();
    expect(
      screen.getByText("ניהול תורים, לקוחות ושימור במקום אחד"),
    ).toBeInTheDocument();
  });

  it("sets RTL direction on the shell wrapper", () => {
    const { container } = render(
      <AuthShell>
        <div />
      </AuthShell>,
    );
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });
});
