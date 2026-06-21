// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PaymentsSettingsForm } from "@/components/settings/payments-settings-form";
import { PAYMENTS } from "@/lib/constants/he";
import type { PaymentSettingsData } from "@/server/payments/settings";

const DEFAULTS: PaymentSettingsData = {
  enabled: false,
  provider: "mock",
  requirement: "none",
  allowPayAtBusiness: true,
  instructions: "",
};

function renderForm(
  initialValues: Partial<PaymentSettingsData> = {},
  connectionStatus: "mock" | "active" | "not_connected" | "error" = "mock",
  action = vi.fn(async () => ({})),
) {
  render(
    <PaymentsSettingsForm
      action={action as never}
      initialValues={{ ...DEFAULTS, ...initialValues }}
      connectionStatus={connectionStatus}
    />,
  );
  return { action };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PaymentsSettingsForm", () => {
  it("renders the section hint, enable toggle and save button; hides details when disabled", () => {
    renderForm();
    expect(screen.getByText(PAYMENTS.settings.sectionHint)).toBeInTheDocument();
    expect(screen.getByText(PAYMENTS.settings.enableLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: PAYMENTS.settings.save }),
    ).toBeInTheDocument();
    // Details panel is hidden while disabled.
    expect(
      screen.queryByText(PAYMENTS.settings.providerLabel),
    ).not.toBeInTheDocument();
  });

  it("reveals provider, requirement, pay-at-business and instructions when enabled", () => {
    renderForm({ enabled: true });
    expect(screen.getByText(PAYMENTS.settings.providerLabel)).toBeInTheDocument();
    expect(screen.getByText(PAYMENTS.settings.requirementLabel)).toBeInTheDocument();
    expect(
      screen.getByText(PAYMENTS.settings.allowPayAtBusinessLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(PAYMENTS.settings.instructionsLabel),
    ).toBeInTheDocument();
    // Provider pills.
    expect(
      screen.getByRole("button", { name: PAYMENTS.settings.provider.payplus }),
    ).toBeInTheDocument();
  });

  it("shows the not-connected notice for a real provider that isn't active", () => {
    // enabled + provider != mock + status != active -> shows notice.
    renderForm({ enabled: true, provider: "payplus" }, "not_connected");
    expect(
      screen.getByText(PAYMENTS.settings.notConnectedTitle),
    ).toBeInTheDocument();
  });

  it("never shows the not-connected notice for the mock provider", () => {
    renderForm({ enabled: true, provider: "mock" }, "not_connected");
    expect(
      screen.queryByText(PAYMENTS.settings.notConnectedTitle),
    ).not.toBeInTheDocument();
  });

  it("hides the not-connected notice when the provider connection is active", () => {
    renderForm({ enabled: true, provider: "payplus" }, "active");
    expect(
      screen.queryByText(PAYMENTS.settings.notConnectedTitle),
    ).not.toBeInTheDocument();
  });

  it("toggling enable reveals the panel and the not-connected notice appears for payplus", async () => {
    const user = userEvent.setup();
    renderForm({ enabled: false, provider: "payplus" }, "not_connected");
    expect(
      screen.queryByText(PAYMENTS.settings.providerLabel),
    ).not.toBeInTheDocument();

    // The enable checkbox is the first checkbox.
    const enable = screen.getAllByRole("checkbox")[0];
    await user.click(enable);
    expect(screen.getByText(PAYMENTS.settings.providerLabel)).toBeInTheDocument();
    expect(
      screen.getByText(PAYMENTS.settings.notConnectedTitle),
    ).toBeInTheDocument();
  });

  it("selecting a provider and requirement updates the hidden inputs and submits them", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    const { container } = render(
      <PaymentsSettingsForm
        action={action as never}
        initialValues={{ ...DEFAULTS, enabled: true }}
        connectionStatus="mock"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: PAYMENTS.settings.provider.tranzila }),
    );
    await user.click(
      screen.getByRole("button", {
        name: PAYMENTS.settings.requirement.full_payment,
      }),
    );

    expect(
      (container.querySelector('input[name="provider"]') as HTMLInputElement).value,
    ).toBe("tranzila");
    expect(
      (container.querySelector('input[name="requirement"]') as HTMLInputElement)
        .value,
    ).toBe("full_payment");

    await user.click(screen.getByRole("button", { name: PAYMENTS.settings.save }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    const fd = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.get("provider")).toBe("tranzila");
    expect(fd.get("requirement")).toBe("full_payment");
    expect(fd.get("enabled")).toBe("true");
  });

  it("prefills the instructions textarea from initialValues", () => {
    renderForm({ enabled: true, instructions: "אין החזרים" });
    expect(
      screen.getByLabelText(PAYMENTS.settings.instructionsLabel),
    ).toHaveValue("אין החזרים");
  });

  it("toggles the allow-pay-at-business checkbox", async () => {
    const user = userEvent.setup();
    renderForm({ enabled: true, allowPayAtBusiness: true });
    const payAt = screen.getAllByRole("checkbox")[1];
    expect(payAt).toBeChecked();
    await user.click(payAt);
    expect(payAt).not.toBeChecked();
  });

  it("renders form error and success messages from the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ formError: "שגיאה" }));
    const { rerender } = render(
      <PaymentsSettingsForm
        action={action as never}
        initialValues={{ ...DEFAULTS, enabled: true }}
        connectionStatus="mock"
      />,
    );
    await user.click(screen.getByRole("button", { name: PAYMENTS.settings.save }));
    expect(await screen.findByText("שגיאה")).toBeInTheDocument();

    rerender(
      <PaymentsSettingsForm
        action={(vi.fn(async () => ({ success: PAYMENTS.settings.success })) as never)}
        initialValues={{ ...DEFAULTS, enabled: true }}
        connectionStatus="mock"
      />,
    );
  });

  it("renders the success message", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: PAYMENTS.settings.success }));
    renderForm({ enabled: true }, "mock", action);
    await user.click(screen.getByRole("button", { name: PAYMENTS.settings.save }));
    expect(await screen.findByText(PAYMENTS.settings.success)).toBeInTheDocument();
  });
});
