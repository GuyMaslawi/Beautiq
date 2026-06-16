// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsAppConnectionCard } from "@/components/whatsapp/whatsapp-connection-card";
import type { OwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";

/**
 * The connection card must update WITHOUT a manual browser refresh after the
 * Meta Embedded Signup popup closes:
 *   - success  -> refetch server status + router.refresh(), show connected
 *   - cancelled-> show "החיבור לא הושלם", never call the completion action
 *   - postMessage alone is NOT proof of connection
 *   - template failure does NOT reset the connected state
 *   - polling stops after the status resolves
 */

const m = vi.hoisted(() => ({
  completeEmbeddedSignupAction: vi.fn(),
  disconnectWhatsAppAction: vi.fn(() => Promise.resolve({ success: true })),
  getWhatsAppConnectionStatusAction: vi.fn(),
  createDefaultTemplatesAction: vi.fn(() => Promise.resolve({ success: true, statusLabel: "ok", items: [] })),
  syncTemplatesAction: vi.fn(() => Promise.resolve({ success: true, statusLabel: "ok", items: [] })),
  refresh: vi.fn(),
}));

vi.mock("@/server/whatsapp/embedded-signup-actions", () => ({
  completeEmbeddedSignupAction: m.completeEmbeddedSignupAction,
  disconnectWhatsAppAction: m.disconnectWhatsAppAction,
}));
vi.mock("@/server/whatsapp/connection-status-actions", () => ({
  getWhatsAppConnectionStatusAction: m.getWhatsAppConnectionStatusAction,
}));
vi.mock("@/server/whatsapp/templates-actions", () => ({
  createDefaultTemplatesAction: m.createDefaultTemplatesAction,
  syncTemplatesAction: m.syncTemplatesAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: m.refresh, push: vi.fn() }),
}));
// next/script: render nothing (no external SDK load in tests).
vi.mock("next/script", () => ({ default: () => null }));

function makeStatus(state: OwnerWhatsAppStatus["connection"]["state"]): OwnerWhatsAppStatus {
  const labels: Record<string, string> = {
    not_connected: "WhatsApp לא מחובר",
    pending: "מחברים את WhatsApp",
    active: "WhatsApp מחובר",
    error: "יש בעיה בחיבור WhatsApp",
  };
  return {
    connection: {
      ready: state === "active",
      state,
      statusLabel: labels[state],
      displayPhoneNumber: state === "active" ? "+972 50-123-4567" : undefined,
    },
    automations: [],
    anyReady: false,
  };
}

/** Install a fake FB SDK whose login() drives the requested popup outcome. */
function installFb(outcome: "success" | "cancel" | "no-waba") {
  (window as unknown as { FB: unknown }).FB = {
    init: vi.fn(),
    login: (cb: (r: unknown) => void) => {
      if (outcome === "success" || outcome === "no-waba") {
        const data: Record<string, string> = { waba_id: "w1", phone_number_id: "p1" };
        if (outcome === "no-waba") delete data.waba_id;
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://www.facebook.com",
            data: JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data }),
          }),
        );
        cb({ status: "connected", authResponse: { code: "auth_code_123" } });
      } else {
        // User closed the popup without authorizing — no code.
        cb({ status: "unknown", authResponse: null });
      }
    },
  };
}

const PROPS = { appId: "app_1", configId: "cfg_1", graphVersion: "v19.0" } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { FB?: unknown }).FB;
});

describe("WhatsAppConnectionCard — post-popup completion", () => {
  it("on success: refetches business-scoped status and calls router.refresh (no manual refresh)", async () => {
    installFb("success");
    m.completeEmbeddedSignupAction.mockResolvedValue({
      success: true,
      statusLabel: "WhatsApp מחובר",
      templatesPrepared: true,
    });
    m.getWhatsAppConnectionStatusAction.mockResolvedValue({ connected: true, state: "active", statusLabel: "WhatsApp מחובר" });

    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));

    await waitFor(() => {
      expect(m.completeEmbeddedSignupAction).toHaveBeenCalledWith({
        code: "auth_code_123",
        wabaId: "w1",
        phoneNumberId: "p1",
      });
    });
    // Parent refetches server-side status and refreshes the route.
    await waitFor(() => expect(m.getWhatsAppConnectionStatusAction).toHaveBeenCalled());
    expect(m.refresh).toHaveBeenCalled();
  });

  it("polling stops once the status resolves (status action called once on immediate-active)", async () => {
    installFb("success");
    m.completeEmbeddedSignupAction.mockResolvedValue({ success: true, statusLabel: "WhatsApp מחובר", templatesPrepared: true });
    m.getWhatsAppConnectionStatusAction.mockResolvedValue({ connected: true, state: "active", statusLabel: "WhatsApp מחובר" });

    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);
    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));

    await waitFor(() => expect(m.getWhatsAppConnectionStatusAction).toHaveBeenCalledTimes(1));
    // Give any erroneous extra poll a chance to fire, then assert it did not.
    await new Promise((r) => setTimeout(r, 50));
    expect(m.getWhatsAppConnectionStatusAction).toHaveBeenCalledTimes(1);
  });

  it("popup closed without a code shows 'החיבור לא הושלם' and never calls the completion action", async () => {
    installFb("cancel");
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));

    await waitFor(() => expect(screen.getByText("החיבור לא הושלם")).toBeInTheDocument());
    expect(screen.getByText("אפשר לנסות שוב בכל זמן.")).toBeInTheDocument();
    expect(m.completeEmbeddedSignupAction).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("postMessage alone does NOT mark the connection as connected", async () => {
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://www.facebook.com",
          data: JSON.stringify({
            type: "WA_EMBEDDED_SIGNUP",
            event: "FINISH",
            data: { waba_id: "w1", phone_number_id: "p1" },
          }),
        }),
      );
    });

    // No completion action, no status refetch, card stays "not connected".
    expect(m.completeEmbeddedSignupAction).not.toHaveBeenCalled();
    expect(m.getWhatsAppConnectionStatusAction).not.toHaveBeenCalled();
    expect(screen.getByText("WhatsApp לא מחובר")).toBeInTheDocument();
  });

  it("template failure does NOT reset connected state (shown as a separate warning)", async () => {
    installFb("success");
    m.completeEmbeddedSignupAction.mockResolvedValue({
      success: true,
      statusLabel: "WhatsApp מחובר, אך יצירת התבניות נכשלה",
      templatesPrepared: false,
      templateError: "Template text too long",
    });
    m.getWhatsAppConnectionStatusAction.mockResolvedValue({ connected: true, state: "active", statusLabel: "WhatsApp מחובר" });

    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);
    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));

    // Connection succeeded (success message) AND the template warning is separate.
    await waitFor(() => expect(screen.getByText("WhatsApp מחובר")).toBeInTheDocument());
    expect(screen.getByText(/יצירת התבניות נכשלה/)).toBeInTheDocument();
    // Still treated as a successful connection -> route refreshed to show it.
    expect(m.refresh).toHaveBeenCalled();
  });

  it("error connection state shows safe Hebrew copy (no raw reason for non-admins)", () => {
    const status = makeStatus("error");
    status.connection.reason = "Phone Number ID חסר";
    render(<WhatsAppConnectionCard status={status} {...PROPS} isAdmin={false} />);

    expect(screen.getByText(/לא הצלחנו להשלים את החיבור/)).toBeInTheDocument();
    expect(screen.queryByText(/Phone Number ID חסר/)).not.toBeInTheDocument();
  });
});
