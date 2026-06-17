// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WhatsAppStatusBanners } from "@/components/whatsapp/whatsapp-status-banners";

/**
 * The /automations status banners must hide every test-mode / dev / env-fallback
 * message from regular business owners. Owners only ever see owner-safe states
 * (connected / connection-error). Admins keep the full diagnostic banners.
 */

afterEach(cleanup);

const TEST_MODE_PROPS = {
  realSendConfigured: true,
  testMode: true,
  isEnvFallback: false,
  connectionState: "active" as const,
  whatsappConnected: true,
};

describe("WhatsAppStatusBanners — owner visibility", () => {
  it("a NON-ADMIN owner never sees the test-mode banner or test-number restriction copy", () => {
    render(<WhatsAppStatusBanners isAdmin={false} {...TEST_MODE_PROPS} />);

    expect(screen.queryByText(/מצב בדיקה פעיל/)).not.toBeInTheDocument();
    expect(screen.queryByText(/הודעות נשלחות רק למספר הבדיקה/)).not.toBeInTheDocument();
  });

  it("a NON-ADMIN owner never sees the dev-mode banner", () => {
    render(
      <WhatsAppStatusBanners
        isAdmin={false}
        realSendConfigured={false}
        testMode={false}
        isEnvFallback={false}
        connectionState="not_connected"
        whatsappConnected={false}
      />,
    );

    // Dev banner ("מצב בדיקה" / not sent to real clients) is admin-only.
    expect(screen.queryByText(/מצב בדיקה/)).not.toBeInTheDocument();
    expect(screen.queryByText(/לא נשלחות ללקוחות אמיתיים/)).not.toBeInTheDocument();
  });

  it("a NON-ADMIN owner never sees the env-fallback banner", () => {
    render(
      <WhatsAppStatusBanners
        isAdmin={false}
        realSendConfigured
        testMode={false}
        isEnvFallback
        connectionState="not_connected"
        whatsappConnected={false}
      />,
    );

    expect(screen.queryByText(/החיבור מוגדר ברמת המערכת/)).not.toBeInTheDocument();
  });

  it("a NON-ADMIN owner sees a clean connected banner without test-mode wording", () => {
    render(
      <WhatsAppStatusBanners
        isAdmin={false}
        realSendConfigured
        testMode={false}
        isEnvFallback={false}
        connectionState="active"
        whatsappConnected
      />,
    );

    expect(screen.getByText("WhatsApp מחובר")).toBeInTheDocument();
    expect(screen.getByText("האוטומציות פעילות לפי ההגדרות שלך.")).toBeInTheDocument();
    // No "test mode off" technical sub-line for owners.
    expect(screen.queryByText(/מצב בדיקה כבוי/)).not.toBeInTheDocument();
  });

  it("a NON-ADMIN owner still sees an owner-safe connection-error banner", () => {
    render(
      <WhatsAppStatusBanners
        isAdmin={false}
        realSendConfigured
        testMode={false}
        isEnvFallback={false}
        connectionState="error"
        whatsappConnected={false}
      />,
    );

    expect(screen.getByText(/לא הצלחנו לחבר את WhatsApp/)).toBeInTheDocument();
  });
});

describe("WhatsAppStatusBanners — admin visibility", () => {
  it("an ADMIN still sees the test-mode banner with the test-number restriction copy", () => {
    render(<WhatsAppStatusBanners isAdmin {...TEST_MODE_PROPS} />);

    expect(screen.getByText(/מצב בדיקה פעיל/)).toBeInTheDocument();
    expect(screen.getByText(/הודעות נשלחות רק למספר הבדיקה/)).toBeInTheDocument();
  });

  it("an ADMIN sees the dev-mode banner", () => {
    render(
      <WhatsAppStatusBanners
        isAdmin
        realSendConfigured={false}
        testMode={false}
        isEnvFallback={false}
        connectionState="not_connected"
        whatsappConnected={false}
      />,
    );

    expect(screen.getByText(/לא נשלחות ללקוחות אמיתיים/)).toBeInTheDocument();
  });

  it("an ADMIN sees the technical sub-line on the connected banner", () => {
    render(
      <WhatsAppStatusBanners
        isAdmin
        realSendConfigured
        testMode={false}
        isEnvFallback={false}
        connectionState="active"
        whatsappConnected
      />,
    );

    expect(screen.getByText(/מצב בדיקה כבוי · חיבור ברמת העסק/)).toBeInTheDocument();
  });
});
