// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  sendManualClientWhatsAppAction: vi.fn(),
  adminSendManualClientWhatsAppAction: vi.fn(),
}));
vi.mock("@/server/clients/whatsapp-actions", () => ({
  sendManualClientWhatsAppAction: m.sendManualClientWhatsAppAction,
}));
vi.mock("@/server/admin/client-actions", () => ({
  adminSendManualClientWhatsAppAction: m.adminSendManualClientWhatsAppAction,
}));

import { WhatsAppManualSendModal } from "@/components/clients/whatsapp-manual-send-modal";

const BASE = {
  clientId: "c1",
  clientName: "נועה כהן",
  clientPhone: "0501234567",
  businessName: "סטודיו יופי",
};

function renderModal(props: Partial<React.ComponentProps<typeof WhatsAppManualSendModal>> = {}) {
  return render(
    <WhatsAppManualSendModal
      {...BASE}
      isTestMode={false}
      trigger={<button type="button">פתח</button>}
      {...props}
    />,
  );
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("פתח"));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.sendManualClientWhatsAppAction.mockResolvedValue({ success: true });
  m.adminSendManualClientWhatsAppAction.mockResolvedValue({ success: true });
});

describe("WhatsAppManualSendModal — open/close", () => {
  it("renders only the trigger initially; modal opens on click", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.queryByText("שליחת הודעת WhatsApp")).not.toBeInTheDocument();
    await open(user);
    expect(screen.getByText("שליחת הודעת WhatsApp")).toBeInTheDocument();
  });

  it("masks the client phone in the confirm step", async () => {
    const user = userEvent.setup();
    renderModal();
    await open(user);
    // 0501234567 -> first 3 + *** + last 3
    expect(screen.getByText("050***567")).toBeInTheDocument();
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText("סטודיו יופי")).toBeInTheDocument();
  });

  it("closes via the cancel button", async () => {
    const user = userEvent.setup();
    renderModal();
    await open(user);
    await user.click(screen.getByRole("button", { name: "ביטול" }));
    await waitFor(() => expect(screen.queryByText("שליחת הודעת WhatsApp")).not.toBeInTheDocument());
  });

  it("closes via the backdrop click", async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    await open(user);
    await user.click(container.querySelector(".bg-black\\/40") as Element);
    await waitFor(() => expect(screen.queryByText("שליחת הודעת WhatsApp")).not.toBeInTheDocument());
  });
});

describe("WhatsAppManualSendModal — owner message types", () => {
  it("shows the 3 owner message types and defaults to win_back", async () => {
    const user = userEvent.setup();
    renderModal();
    await open(user);
    expect(screen.getByText("הודעת החזרה ללקוחה")).toBeInTheDocument();
    expect(screen.getByText("תזכורת לתור")).toBeInTheDocument();
    expect(screen.getByText("בקשת ביקורת")).toBeInTheDocument();
    // No admin-only test type for owners.
    expect(screen.queryByText("הודעת בדיקה")).not.toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked(); // win_back default
  });

  it("shows the win_back preview by default and switches preview when a type is selected", async () => {
    const user = userEvent.setup();
    renderModal();
    await open(user);
    expect(screen.getByText(/מתגעגעים אליך/)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /תזכורת לתור/ }));
    expect(screen.getByText(/רק תזכורת קטנה/)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /בקשת ביקורת/ }));
    expect(screen.getByText(/נשמח אם תוכלי להשאיר ביקורת/)).toBeInTheDocument();
  });
});

describe("WhatsAppManualSendModal — admin message types", () => {
  it("shows the admin test type and defaults to manual_test", async () => {
    const user = userEvent.setup();
    renderModal({ isAdmin: true });
    await open(user);
    expect(screen.getByText("הודעת בדיקה")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked(); // manual_test default for admin
    expect(screen.getByText(/זוהי הודעת בדיקה/)).toBeInTheDocument();
  });

  it("admin send uses the admin action (no forceIfRecent arg)", async () => {
    const user = userEvent.setup();
    renderModal({ isAdmin: true });
    await open(user);
    await user.click(screen.getByRole("button", { name: "שליחה" }));
    await waitFor(() =>
      expect(m.adminSendManualClientWhatsAppAction).toHaveBeenCalledWith("c1", "manual_test"),
    );
    expect(m.sendManualClientWhatsAppAction).not.toHaveBeenCalled();
  });
});

describe("WhatsAppManualSendModal — test mode notice", () => {
  it("shows the test-mode banner and 'מספר הבדיקה' recipient when isTestMode", async () => {
    const user = userEvent.setup();
    renderModal({ isTestMode: true });
    await open(user);
    expect(screen.getByText("מצב בדיקה פעיל")).toBeInTheDocument();
    expect(screen.getByText("מספר הבדיקה")).toBeInTheDocument();
  });

  it("shows 'הלקוחה' recipient when not in test mode", async () => {
    const user = userEvent.setup();
    renderModal({ isTestMode: false });
    await open(user);
    expect(screen.getByText("הלקוחה")).toBeInTheDocument();
    expect(screen.queryByText("מצב בדיקה פעיל")).not.toBeInTheDocument();
  });
});

describe("WhatsAppManualSendModal — send flow (owner)", () => {
  it("sends via the owner action and shows the success step", async () => {
    const user = userEvent.setup();
    renderModal();
    await open(user);
    await user.click(screen.getByRole("button", { name: "שליחה" }));

    await waitFor(() =>
      expect(m.sendManualClientWhatsAppAction).toHaveBeenCalledWith("c1", "win_back", undefined),
    );
    expect(await screen.findByText("ההודעה נשלחה")).toBeInTheDocument();
  });

  it("shows the test-mode success copy when the action reports test mode", async () => {
    m.sendManualClientWhatsAppAction.mockResolvedValue({ success: true, isTestMode: true });
    const user = userEvent.setup();
    renderModal();
    await open(user);
    await user.click(screen.getByRole("button", { name: "שליחה" }));
    expect(await screen.findByText("ההודעה נשלחה למספר הבדיקה")).toBeInTheDocument();
    expect(
      screen.getByText("מצב בדיקה פעיל — ההודעה הגיעה למספר הבדיקה בלבד"),
    ).toBeInTheDocument();
  });

  it("shows the error step with the returned error message", async () => {
    m.sendManualClientWhatsAppAction.mockResolvedValue({ error: "מספר לא תקין" });
    const user = userEvent.setup();
    renderModal();
    await open(user);
    await user.click(screen.getByRole("button", { name: "שליחה" }));

    expect(await screen.findByText("לא נשלחה הודעה")).toBeInTheDocument();
    expect(screen.getByText("מספר לא תקין")).toBeInTheDocument();
    // Close from the error step.
    await user.click(screen.getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(screen.queryByText("לא נשלחה הודעה")).not.toBeInTheDocument());
  });

  it("closes from the success step", async () => {
    const user = userEvent.setup();
    renderModal();
    await open(user);
    await user.click(screen.getByRole("button", { name: "שליחה" }));
    await screen.findByText("ההודעה נשלחה");
    await user.click(screen.getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(screen.queryByText("ההודעה נשלחה")).not.toBeInTheDocument());
  });
});

describe("WhatsAppManualSendModal — recent-message warning", () => {
  it("shows the recent warning step, then resends with forceIfRecent=true", async () => {
    m.sendManualClientWhatsAppAction
      .mockResolvedValueOnce({ recentMessageWarning: true })
      .mockResolvedValueOnce({ success: true });

    const user = userEvent.setup();
    renderModal();
    await open(user);
    await user.click(screen.getByRole("button", { name: "שליחה" }));

    expect(await screen.findByText("נשלחה הודעה ללקוחה לאחרונה")).toBeInTheDocument();
    expect(screen.getByText(/נשלחה הודעת WhatsApp לנועה כהן/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "שליחה בכל זאת" }));
    await waitFor(() =>
      expect(m.sendManualClientWhatsAppAction).toHaveBeenLastCalledWith("c1", "win_back", true),
    );
    expect(await screen.findByText("ההודעה נשלחה")).toBeInTheDocument();
  });

  it("can cancel from the recent-warning step", async () => {
    m.sendManualClientWhatsAppAction.mockResolvedValueOnce({ recentMessageWarning: true });
    const user = userEvent.setup();
    renderModal();
    await open(user);
    await user.click(screen.getByRole("button", { name: "שליחה" }));
    await screen.findByText("נשלחה הודעה ללקוחה לאחרונה");

    await user.click(screen.getByRole("button", { name: "ביטול" }));
    await waitFor(() =>
      expect(screen.queryByText("נשלחה הודעה ללקוחה לאחרונה")).not.toBeInTheDocument(),
    );
  });
});

describe("WhatsAppManualSendModal — reopen resets state", () => {
  it("resets to the confirm step and default type when reopened", async () => {
    const user = userEvent.setup();
    renderModal();
    await open(user);
    // switch type, then send to reach success
    await user.click(screen.getByRole("radio", { name: /תזכורת לתור/ }));
    await user.click(screen.getByRole("button", { name: "שליחה" }));
    await screen.findByText("ההודעה נשלחה");
    await user.click(screen.getByRole("button", { name: "סגירה" }));

    // Reopen — back on confirm step with win_back selected again.
    await open(user);
    expect(screen.getByText("שליחת הודעת WhatsApp")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
  });
});

describe("WhatsAppManualSendModal — phone masking edge case", () => {
  it("returns the phone unchanged when fewer than 7 digits", async () => {
    const user = userEvent.setup();
    renderModal({ clientPhone: "12345" });
    await open(user);
    expect(screen.getByText("12345")).toBeInTheDocument();
  });
});
