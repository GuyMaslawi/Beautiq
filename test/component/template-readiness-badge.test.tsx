// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TemplateReadinessBadge } from "@/components/automations/template-readiness-badge";

/**
 * The automation-card readiness badge must never leak the internal "מצב בדיקה
 * פעיל" (test-mode) state to a regular business owner. Owners always see a plain
 * product state derived from the template status; only admins see test-mode.
 */

afterEach(cleanup);

describe("TemplateReadinessBadge — owner vs admin test-mode visibility", () => {
  it("a NON-ADMIN owner in test mode never sees 'מצב בדיקה פעיל' — shows the product state", () => {
    render(
      <TemplateReadinessBadge
        realSendConfigured
        testMode
        isAdmin={false}
        templateName="morning_reminder_he"
        templateStatus="pending"
      />,
    );

    expect(screen.queryByText("מצב בדיקה פעיל")).not.toBeInTheDocument();
    // Falls through to the real product state instead.
    expect(screen.getByText("ממתין לאישור WhatsApp")).toBeInTheDocument();
  });

  it("a NON-ADMIN owner in test mode with an approved template sees 'מוכן לשליחה'", () => {
    render(
      <TemplateReadinessBadge
        realSendConfigured
        testMode
        isAdmin={false}
        templateName="morning_reminder_he"
        templateStatus="approved"
      />,
    );

    expect(screen.queryByText("מצב בדיקה פעיל")).not.toBeInTheDocument();
    expect(screen.getByText("מוכן לשליחה")).toBeInTheDocument();
  });

  it("an ADMIN in test mode still sees the 'מצב בדיקה פעיל' diagnostic state", () => {
    render(
      <TemplateReadinessBadge
        realSendConfigured
        testMode
        isAdmin
        templateName="morning_reminder_he"
        templateStatus="pending"
      />,
    );

    expect(screen.getByText("מצב בדיקה פעיל")).toBeInTheDocument();
  });

  it("an operational template failure shows a simple 'נדרשת בדיקה'-style note (no codes)", () => {
    render(
      <TemplateReadinessBadge
        realSendConfigured
        testMode={false}
        isAdmin={false}
        templateName="booking_confirmation_he"
        templateStatus="rejected"
      />,
    );

    expect(screen.getByText("חלק מהתבניות נדחו — פני לתמיכה")).toBeInTheDocument();
    expect(screen.queryByText("מצב בדיקה פעיל")).not.toBeInTheDocument();
  });

  it("a marketing template failure stays optional, never reads as a blocking problem", () => {
    render(
      <TemplateReadinessBadge
        realSendConfigured
        testMode={false}
        isAdmin={false}
        templateName="win_back_he"
        templateStatus="rejected"
        marketing
      />,
    );

    expect(screen.getByText("תבנית שיווקית נכשלה — אופציונלי")).toBeInTheDocument();
    expect(screen.queryByText("חלק מהתבניות נדחו — פני לתמיכה")).not.toBeInTheDocument();
  });
});
