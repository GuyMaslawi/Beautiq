// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsAppConnectionCard } from "@/components/whatsapp/whatsapp-connection-card";
import type { OwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";
import type { TemplateSetupResult } from "@/server/whatsapp/templates-core";

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
  confirmConnectedNumberAction: vi.fn(() => Promise.resolve({ success: true })),
  getWhatsAppConnectionStatusAction: vi.fn(),
  createDefaultTemplatesAction: vi.fn(
    (): Promise<TemplateSetupResult> =>
      Promise.resolve({
        success: true,
        statusLabel: "ok",
        items: [],
        operationalReady: true,
        marketingReady: true,
        marketingFailed: false,
      }),
  ),
  syncTemplatesAction: vi.fn(
    (): Promise<TemplateSetupResult> =>
      Promise.resolve({
        success: true,
        statusLabel: "ok",
        items: [],
        operationalReady: true,
        marketingReady: true,
        marketingFailed: false,
      }),
  ),
  refresh: vi.fn(),
}));

vi.mock("@/server/whatsapp/embedded-signup-actions", () => ({
  completeEmbeddedSignupAction: m.completeEmbeddedSignupAction,
  disconnectWhatsAppAction: m.disconnectWhatsAppAction,
  confirmConnectedNumberAction: m.confirmConnectedNumberAction,
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

type TplStatus = "approved" | "pending" | "rejected" | "none";

/** Build an operational automation readiness row from a raw template status. */
function opRow(status: TplStatus): OwnerWhatsAppStatus["operational"][number] {
  const map: Record<TplStatus, OwnerWhatsAppStatus["operational"][number]["ownerLabel"]> = {
    approved: "מוכן לשליחה",
    pending: "ממתין לאישור WhatsApp",
    rejected: "נדחתה — פני לתמיכה",
    none: "מכינים תבניות הודעה",
  };
  return {
    type: "booking_confirmation",
    label: "אישור תור",
    ownerLabel: map[status],
    group: "operational",
    ready: status === "approved",
    submitted: status === "approved" || status === "pending",
    failed: status === "rejected",
    templateName: status === "none" ? null : "booking_confirmation_he",
    templateStatus: status === "none" ? null : status,
  };
}

function makeStatus(
  state: OwnerWhatsAppStatus["connection"]["state"],
  extra: Partial<OwnerWhatsAppStatus["connection"]> = {},
  /** Owner setup override — drives the operational readiness banner (states D/E/F). */
  setup: { operational?: TplStatus; ownerSetupState?: OwnerWhatsAppStatus["ownerSetupState"] } = {},
): OwnerWhatsAppStatus {
  const labels: Record<string, string> = {
    not_connected: "WhatsApp לא מחובר",
    pending: "מחברים את WhatsApp",
    active: "WhatsApp מחובר",
    error: "יש בעיה בחיבור WhatsApp",
  };
  const connection = {
    ready: state === "active",
    state,
    statusLabel: labels[state],
    displayPhoneNumber: state === "active" ? "+972 50-123-4567" : undefined,
    ...extra,
  };
  const operational = setup.operational ? [opRow(setup.operational)] : [];
  const operationalApproved = operational.length > 0 && operational.every((a) => a.ready);
  const operationalReady = operational.length > 0 && operational.every((a) => a.submitted);
  const operationalFailed = operational.some((a) => a.failed);
  const numberConfirmed = state === "active" && !connection.needsNumberConfirmation;

  let ownerSetupState: OwnerWhatsAppStatus["ownerSetupState"];
  if (setup.ownerSetupState) {
    ownerSetupState = setup.ownerSetupState;
  } else if (state !== "active") {
    ownerSetupState = state === "pending" ? "connecting" : "not_connected";
  } else if (connection.needsNumberConfirmation) {
    ownerSetupState = "needs_confirmation";
  } else if (operationalFailed) {
    ownerSetupState = "needs_support";
  } else if (operationalApproved) {
    ownerSetupState = "ready";
  } else if (operationalReady) {
    ownerSetupState = "pending_approval";
  } else {
    ownerSetupState = "preparing";
  }
  const ownerLabels: Record<OwnerWhatsAppStatus["ownerSetupState"], string> = {
    not_connected: "WhatsApp לא מחובר",
    connecting: "בודקים את החיבור",
    needs_confirmation: "נדרש אישור מספר",
    preparing: "מכינים את הודעות WhatsApp",
    pending_approval: "ממתין לאישור WhatsApp",
    ready: "WhatsApp מוכן לשליחה",
    needs_support: "נדרשת בדיקה",
  };

  return {
    connection,
    automations: operational,
    operational,
    marketing: [],
    anyReady: operationalApproved,
    operationalReady,
    marketingReady: false,
    marketingFailed: false,
    readiness: {
      connectionReady: state === "active",
      numberConfirmed,
      operationalTemplatesReadyOrPending: operationalReady,
      marketingTemplateReadyOrPending: false,
      canSendOperationalMessages: numberConfirmed && operationalApproved,
      canSendMarketingMessages: false,
    },
    ownerSetupState,
    ownerSetupLabel: ownerLabels[ownerSetupState],
  };
}

/**
 * Drive the pre-connection chooser: open it, pick a track, and continue to Meta.
 * Defaults to the "new number" track (the simplest, no acknowledgement gate).
 */
async function openConnect(
  user: ReturnType<typeof userEvent.setup>,
  trackTitle = "אין לי מספר עסקי / אני רוצה מספר חדש",
) {
  await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));
  await user.click(await screen.findByText(trackTitle));
  await user.click(screen.getByRole("button", { name: /המשך לחיבור ב־Meta/ }));
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

    await openConnect(user);

    await waitFor(() => {
      expect(m.completeEmbeddedSignupAction).toHaveBeenCalledWith({
        code: "auth_code_123",
        wabaId: "w1",
        phoneNumberId: "p1",
        intent: "new_number",
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
    await openConnect(user);

    await waitFor(() => expect(m.getWhatsAppConnectionStatusAction).toHaveBeenCalledTimes(1));
    // Give any erroneous extra poll a chance to fire, then assert it did not.
    await new Promise((r) => setTimeout(r, 50));
    expect(m.getWhatsAppConnectionStatusAction).toHaveBeenCalledTimes(1);
  });

  it("popup closed without a code shows 'החיבור לא הושלם' and never calls the completion action", async () => {
    installFb("cancel");
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await openConnect(user);

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
    await openConnect(user);

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

describe("WhatsAppConnectionCard — pre-connection chooser", () => {
  it("opens the chooser with all three onboarding options (no Meta launch yet)", async () => {
    installFb("success");
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));

    expect(await screen.findByText("איזה מספר WhatsApp תרצי לחבר?")).toBeInTheDocument();
    expect(screen.getByText("יש לי WhatsApp Business קיים")).toBeInTheDocument();
    expect(screen.getByText("יש לי WhatsApp רגיל/אישי")).toBeInTheDocument();
    expect(screen.getByText("אין לי מספר עסקי / אני רוצה מספר חדש")).toBeInTheDocument();
    expect(screen.getByText("מומלץ לרוב העסקים")).toBeInTheDocument();
    // Picking a track must NOT launch Meta until "המשך" is pressed.
    expect(m.completeEmbeddedSignupAction).not.toHaveBeenCalled();
  });

  it("selecting 'existing WhatsApp Business' shows its explanation and sends intent=existing_business_app", async () => {
    installFb("success");
    m.completeEmbeddedSignupAction.mockResolvedValue({ success: true, statusLabel: "WhatsApp מחובר", templatesPrepared: true });
    m.getWhatsAppConnectionStatusAction.mockResolvedValue({ connected: true, state: "active", statusLabel: "WhatsApp מחובר" });

    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));
    await user.click(await screen.findByText("יש לי WhatsApp Business קיים"));
    expect(screen.getByText(/בחלון של Meta בחרי את חשבון ה־WhatsApp Business הקיים/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /המשך לחיבור ב־Meta/ }));
    await waitFor(() =>
      expect(m.completeEmbeddedSignupAction).toHaveBeenCalledWith(
        expect.objectContaining({ intent: "existing_business_app" }),
      ),
    );
  });

  it("personal track shows a warning and blocks continue until acknowledged", async () => {
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));
    await user.click(await screen.findByText("יש לי WhatsApp רגיל/אישי"));

    expect(screen.getByText("מספר אישי שכבר רשום ב־WhatsApp עלול להיחסם בתהליך החיבור.")).toBeInTheDocument();
    const continueBtn = screen.getByRole("button", { name: /המשך לחיבור ב־Meta/ });
    expect(continueBtn).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(continueBtn).toBeEnabled();
  });
});

describe("WhatsAppConnectionCard — already-registered error", () => {
  it("maps an already-registered popup error to a friendly Hebrew explanation with safe actions", async () => {
    // FB popup surfaces an already-registered error, then returns no code.
    (window as unknown as { FB: unknown }).FB = {
      init: vi.fn(),
      login: (cb: (r: unknown) => void) => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://www.facebook.com",
            data: JSON.stringify({
              type: "WA_EMBEDDED_SIGNUP",
              event: "ERROR",
              data: { error_message: "This phone number is already registered" },
            }),
          }),
        );
        cb({ status: "unknown", authResponse: null });
      },
    };

    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} isAdmin={false} />);

    await openConnect(user);

    expect(await screen.findByText("המספר כבר רשום ב־WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /לנסות שוב עם WhatsApp Business קיים/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /להשתמש במספר חדש/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /קראתי והבנתי/ })).toBeInTheDocument();
    // Raw Meta error must NOT be shown to a non-admin owner.
    expect(screen.queryByText(/already registered/)).not.toBeInTheDocument();
    // No connection was claimed.
    expect(m.completeEmbeddedSignupAction).not.toHaveBeenCalled();
  });
});

describe("WhatsAppConnectionCard — connected number confirmation", () => {
  it("shows the confirmation step and blocks until the owner confirms the number", async () => {
    const user = userEvent.setup();
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", {
          needsNumberConfirmation: true,
          connectionSource: "existing_business_app",
          displayPhoneNumber: "+972 50-123-4567",
        })}
        {...PROPS}
      />,
    );

    expect(screen.getByText("אישור המספר המחובר")).toBeInTheDocument();
    expect(screen.getByText(/\+972 50-123-4567/)).toBeInTheDocument();
    // Template setup must NOT be available until the number is confirmed.
    expect(screen.queryByText("תבניות הודעות")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /זה המספר הנכון/ }));
    await waitFor(() => expect(m.confirmConnectedNumberAction).toHaveBeenCalled());
    expect(m.refresh).toHaveBeenCalled();
  });

  it("warns ADMINS when the connected number looks like a Meta +1 555 test number", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", {
          needsNumberConfirmation: true,
          connectionSource: "new_number",
          displayPhoneNumber: "+1 555-000-0000",
        })}
        {...PROPS}
        isAdmin
      />,
    );

    expect(screen.getByText(/נראה כמו מספר בדיקה של Meta/)).toBeInTheDocument();
  });

  it("a NON-ADMIN owner never sees the 555/Meta test-number warning — only simple copy", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", {
          needsNumberConfirmation: true,
          connectionSource: "new_number",
          displayPhoneNumber: "+1 555-000-0000",
        })}
        {...PROPS}
        isAdmin={false}
      />,
    );

    // No technical Meta/555 wording for owners.
    expect(screen.queryByText(/מספר בדיקה של Meta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/מתחיל ב־555/)).not.toBeInTheDocument();
    // Simple, owner-safe guidance instead.
    expect(screen.getByText("אם זה לא המספר העסקי שלך, ניתן לנתק ולחבר מחדש.")).toBeInTheDocument();
  });

  it("warns ADMINS on a +1 555 number even after the number is confirmed (still flagged as a test number)", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", {
          needsNumberConfirmation: false,
          displayPhoneNumber: "+1 555-906-9761",
        })}
        {...PROPS}
        isAdmin
      />,
    );

    // Connection is shown as connected (not disconnected) AND the test-number warning shows.
    expect(screen.getByText(/מחובר למספר/)).toBeInTheDocument();
    expect(screen.getByText(/נראה כמו מספר בדיקה של Meta/)).toBeInTheDocument();
    // A test number must never read as "not connected".
    expect(screen.queryByText("WhatsApp לא מחובר")).not.toBeInTheDocument();
  });

  it("a NON-ADMIN owner with a confirmed 555 number sees only simple copy, no Meta wording", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", {
          needsNumberConfirmation: false,
          displayPhoneNumber: "+1 555-906-9761",
        })}
        {...PROPS}
        isAdmin={false}
      />,
    );

    expect(screen.getByText(/מחובר למספר/)).toBeInTheDocument();
    expect(screen.queryByText(/מספר בדיקה של Meta/)).not.toBeInTheDocument();
    expect(screen.getByText("אם זה לא המספר העסקי שלך, ניתן לנתק ולחבר מחדש.")).toBeInTheDocument();
  });

  it("does not warn for a normal Israeli connected number", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", {
          needsNumberConfirmation: false,
          displayPhoneNumber: "+972 50-123-4567",
        })}
        {...PROPS}
      />,
    );

    expect(screen.queryByText(/נראה כמו מספר בדיקה של Meta/)).not.toBeInTheDocument();
  });
});

describe("WhatsAppConnectionCard — admin template debug table", () => {
  function activeStatus() {
    return makeStatus("active", {
      needsNumberConfirmation: false,
      displayPhoneNumber: "+972 50-123-4567",
    });
  }

  it("shows per-template diagnostics with a retry button, then retries a single template", async () => {
    m.createDefaultTemplatesAction.mockResolvedValueOnce({
      success: false,
      statusLabel: "WhatsApp מחובר, אך יצירת התבניות נכשלה",
      items: [
        {
          label: "אישור תור",
          name: "booking_confirmation_he",
          category: "UTILITY",
          language: "he",
          localValid: true,
          status: "error",
          error: "Invalid parameter [code 100 · subcode 2388043]",
          errorSubcode: 2388043,
          fbtraceId: "TraceXYZ",
        },
      ],
      operationalReady: false,
      marketingReady: false,
      marketingFailed: false,
    });

    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={activeStatus()} {...PROPS} isAdmin />);

    await user.click(screen.getByRole("button", { name: /הכנת תבניות WhatsApp/ }));

    // Debug table surfaces the safe Meta error fields for admins.
    expect(await screen.findByText("פרטים טכניים (אדמין בלבד)")).toBeInTheDocument();
    expect(screen.getByText("booking_confirmation_he")).toBeInTheDocument();
    expect(screen.getByText(/subcode 2388043/)).toBeInTheDocument();
    expect(screen.getByText(/fbtrace_id: TraceXYZ/)).toBeInTheDocument();

    // The per-row "נסה ליצור שוב" retries just that template by name.
    m.createDefaultTemplatesAction.mockResolvedValueOnce({
      success: true,
      statusLabel: "התבניות נשלחו לאישור WhatsApp — ממתין לאישור",
      items: [
        {
          label: "אישור תור",
          name: "booking_confirmation_he",
          category: "UTILITY",
          language: "he",
          localValid: true,
          status: "pending",
        },
      ],
      operationalReady: true,
      marketingReady: false,
      marketingFailed: false,
    });
    await user.click(screen.getByRole("button", { name: /נסה ליצור שוב/ }));
    await waitFor(() =>
      expect(m.createDefaultTemplatesAction).toHaveBeenLastCalledWith("booking_confirmation_he"),
    );
  });

  it("a non-admin owner sees NONE of the admin diagnostics area", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", { needsNumberConfirmation: false }, { operational: "pending" })}
        {...PROPS}
        isAdmin={false}
      />,
    );

    // No admin area, no manual template controls, no per-template table.
    expect(screen.queryByText("אזור בדיקות למנהל בלבד")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /הכנת תבניות WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /סנכרון תבניות/ })).not.toBeInTheDocument();
    expect(screen.queryByText("פרטים טכניים (אדמין בלבד)")).not.toBeInTheDocument();
    expect(screen.queryByText("booking_confirmation_he")).not.toBeInTheDocument();
    // The browser-step debug panel is admin-only too.
    expect(screen.queryByText("דיבאג (אדמין בלבד)")).not.toBeInTheDocument();
  });

  it("admin DOES see the diagnostics area + technical controls", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", { needsNumberConfirmation: false }, { operational: "pending" })}
        {...PROPS}
        isAdmin
      />,
    );

    expect(screen.getByText("אזור בדיקות למנהל בלבד")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /הכנת תבניות WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /סנכרון תבניות/ })).toBeInTheDocument();
    expect(screen.getByText("דיבאג חיבור Meta")).toBeInTheDocument();
  });
});

describe("WhatsAppConnectionCard — owner setup status (states D/E/F)", () => {
  it("pending operational templates show 'ממתין לאישור WhatsApp' to the owner", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", { needsNumberConfirmation: false }, { operational: "pending" })}
        {...PROPS}
        isAdmin={false}
      />,
    );

    expect(screen.getByText("ממתין לאישור WhatsApp")).toBeInTheDocument();
    expect(
      screen.getByText(/ההודעות נשלחו לאישור WhatsApp/),
    ).toBeInTheDocument();
    // No support button while merely pending.
    expect(screen.queryByRole("link", { name: /פנייה לתמיכה/ })).not.toBeInTheDocument();
  });

  it("approved operational templates show 'WhatsApp מוכן לשליחה'", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", { needsNumberConfirmation: false }, { operational: "approved" })}
        {...PROPS}
        isAdmin={false}
      />,
    );

    expect(screen.getByText("WhatsApp מוכן לשליחה")).toBeInTheDocument();
    expect(
      screen.getByText(/אפשר להפעיל תזכורות, אישורי תור והודעות חזרה/),
    ).toBeInTheDocument();
  });

  it("a rejected operational template shows 'נדרשת בדיקה' + a support contact (no codes)", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("active", { needsNumberConfirmation: false }, { operational: "rejected" })}
        {...PROPS}
        isAdmin={false}
      />,
    );

    expect(screen.getByText("נדרשת בדיקה")).toBeInTheDocument();
    expect(
      screen.getByText(/לא הצלחנו להכין את כל הודעות WhatsApp/),
    ).toBeInTheDocument();
    const support = screen.getByRole("link", { name: /פנייה לתמיכה/ });
    expect(support).toHaveAttribute("href", expect.stringContaining("mailto:"));
    // Never a technical reason / template name for the owner.
    expect(screen.queryByText("booking_confirmation_he")).not.toBeInTheDocument();
  });

  it("a marketing-only failure stays a calm note, never 'נדרשת בדיקה'", () => {
    const status = makeStatus(
      "active",
      { needsNumberConfirmation: false },
      { operational: "pending" },
    );
    status.marketingFailed = true;
    render(<WhatsAppConnectionCard status={status} {...PROPS} isAdmin={false} />);

    expect(screen.getByText(/הודעות החזרת לקוחות עדיין בהכנה/)).toBeInTheDocument();
    // Operational still pending (not blocked); never escalated to needs-support.
    expect(screen.getByText("ממתין לאישור WhatsApp")).toBeInTheDocument();
    expect(screen.queryByText("נדרשת בדיקה")).not.toBeInTheDocument();
  });
});

/* --------------------------------------------------------------------------
 * Admin Meta launch diagnostics ("דיבאג חיבור Meta") + track-specific payload
 * ------------------------------------------------------------------------ */

/** Install a fake FB SDK whose login() captures the config it was called with. */
function installCapturingFb(): { configs: unknown[] } {
  const configs: unknown[] = [];
  (window as unknown as { FB: unknown }).FB = {
    init: vi.fn(),
    login: (_cb: (r: unknown) => void, config: unknown) => {
      configs.push(config);
      // Close immediately without a code — we only care about the launch payload.
      _cb({ status: "unknown", authResponse: null });
    },
  };
  return { configs };
}

describe("WhatsAppConnectionCard — admin Meta launch diagnostics", () => {
  const PROD_CFG = "1579233260602857";

  it("admin sees the exact production Config ID + 'using the new Config' banner when it matches", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("not_connected")}
        appId="1234567890123456"
        configId={PROD_CFG}
        graphVersion="v19.0"
        isAdmin
      />,
    );
    expect(screen.getByText("דיבאג חיבור Meta")).toBeInTheDocument();
    expect(screen.getByText("הפרודקשן משתמש ב־Config החדש")).toBeInTheDocument();
    // The exact public Config ID is shown to the admin.
    expect(screen.getAllByText(PROD_CFG).length).toBeGreaterThan(0);
  });

  it("admin sees a mismatch warning when the Config ID is not the expected one", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("not_connected")}
        appId="app"
        configId="some_other_cfg"
        graphVersion="v19.0"
        isAdmin
      />,
    );
    expect(screen.getByText("הפרודקשן לא משתמש ב־Config החדש")).toBeInTheDocument();
  });

  it("non-admin never sees the Meta debug box / Config ID details", () => {
    render(
      <WhatsAppConnectionCard
        status={makeStatus("not_connected")}
        appId="1234567890123456"
        configId={PROD_CFG}
        graphVersion="v19.0"
        isAdmin={false}
      />,
    );
    expect(screen.queryByText("דיבאג חיבור Meta")).not.toBeInTheDocument();
    expect(screen.queryByText(PROD_CFG)).not.toBeInTheDocument();
    expect(screen.queryByText("הפרודקשן משתמש ב־Config החדש")).not.toBeInTheDocument();
  });

  it("does not attempt FB.login when window.FB / the SDK is unavailable", async () => {
    // No installFb() — window.FB is absent.
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);
    await openConnect(user);
    expect(
      await screen.findByText("חיבור WhatsApp עדיין לא זמין. נסי שוב מאוחר יותר."),
    ).toBeInTheDocument();
    expect(m.completeEmbeddedSignupAction).not.toHaveBeenCalled();
  });

  it("existing_business track sends featureType=whatsapp_business_app_onboarding", async () => {
    const fb = installCapturingFb();
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);
    await openConnect(user, "יש לי WhatsApp Business קיים");

    await waitFor(() => expect(fb.configs.length).toBe(1));
    const cfg = fb.configs[0] as { extras: { featureType: string } };
    expect(cfg.extras.featureType).toBe("whatsapp_business_app_onboarding");
  });

  it("new_number track does NOT include the existing-business featureType, and differs from existing_business", async () => {
    const fb = installCapturingFb();
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);

    await openConnect(user, "אין לי מספר עסקי / אני רוצה מספר חדש");
    await waitFor(() => expect(fb.configs.length).toBe(1));
    const fresh = fb.configs[0] as { extras: { featureType: string } };
    expect(fresh.extras.featureType).toBe("");
    expect(fresh.extras.featureType).not.toBe("whatsapp_business_app_onboarding");

    // Re-launch with existing-business and confirm the payloads differ.
    await openConnect(user, "יש לי WhatsApp Business קיים");
    await waitFor(() => expect(fb.configs.length).toBe(2));
    expect(fb.configs[0]).not.toEqual(fb.configs[1]);
  });

  it("personal track requires acknowledgement before continuing to Meta", async () => {
    const user = userEvent.setup();
    render(<WhatsAppConnectionCard status={makeStatus("not_connected")} {...PROPS} />);
    await user.click(screen.getByRole("button", { name: /חיבור WhatsApp Business/ }));
    await user.click(await screen.findByText("יש לי WhatsApp רגיל/אישי"));

    const continueBtn = screen.getByRole("button", { name: /המשך לחיבור ב־Meta/ });
    expect(continueBtn).toBeDisabled();

    // Ticking the acknowledgement checkbox enables the continue button.
    await user.click(screen.getByRole("checkbox"));
    expect(continueBtn).toBeEnabled();
  });

  it("the launch payload shown to admins contains no secrets", async () => {
    installCapturingFb();
    const user = userEvent.setup();
    render(
      <WhatsAppConnectionCard
        status={makeStatus("not_connected")}
        appId="1234567890123456"
        configId={PROD_CFG}
        graphVersion="v19.0"
        isAdmin
      />,
    );
    await openConnect(user, "יש לי WhatsApp Business קיים");

    // The masked App ID is shown; the full App ID never appears in the DOM.
    await waitFor(() =>
      expect(screen.getAllByText("1234…56").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText("1234567890123456")).not.toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/token|secret/i);
  });
});
