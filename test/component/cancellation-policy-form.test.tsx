// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CancellationPolicyForm } from "@/components/settings/cancellation-policy-form";
import { SETTINGS } from "@/lib/constants/he";
import type { CancellationPolicyData } from "@/server/settings/queries";

const CP = SETTINGS.cancellationPolicy;

function renderForm(
  initialValues: CancellationPolicyData | null = null,
  action = vi.fn(async () => ({})),
) {
  render(
    <CancellationPolicyForm
      action={action as never}
      initialValues={initialValues}
    />,
  );
  return { action };
}

const enabledPolicy: CancellationPolicyData = {
  id: "p1",
  enabled: true,
  policyText: "מדיניות קיימת",
  minNoticeHours: null,
  lateCancellationHours: 24,
  lateCancellationFeeType: "none",
  lateCancellationFeeAmount: null,
  lateCancellationFeePercentage: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CancellationPolicyForm", () => {
  it("renders the hint, enable toggle and save button; details hidden when disabled", () => {
    renderForm(null);
    expect(screen.getByText(CP.hint)).toBeInTheDocument();
    expect(screen.getByText(CP.enabledLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: CP.saveButton }),
    ).toBeInTheDocument();
    // Disabled by default -> the late-window section is hidden.
    expect(screen.queryByText(CP.lateWindowLabel)).not.toBeInTheDocument();
  });

  it("enabling the policy reveals the details section with preset chips", async () => {
    const user = userEvent.setup();
    renderForm(null);
    await user.click(screen.getByRole("checkbox", { name: CP.enabledLabel }));
    expect(screen.getByText(CP.lateWindowLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: CP.lateWindowOptions["6"] }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: CP.lateWindowOptions["48"] }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: CP.lateWindowOptions.custom }),
    ).toBeInTheDocument();
    expect(screen.getByText(CP.feeTypeLabel)).toBeInTheDocument();
  });

  it("shows the details section pre-enabled from initialValues", () => {
    renderForm(enabledPolicy);
    expect(screen.getByText(CP.lateWindowLabel)).toBeInTheDocument();
    // Pre-filled policy text.
    expect(screen.getByDisplayValue("מדיניות קיימת")).toBeInTheDocument();
  });

  it("defaults the hidden late-cancellation-hours to the 24h preset", () => {
    const { container } = render(
      <CancellationPolicyForm action={(vi.fn(async () => ({})) as never)} initialValues={enabledPolicy} />,
    );
    expect(
      (container.querySelector('input[name="lateCancellationHours"]') as HTMLInputElement)
        .value,
    ).toBe("24");
  });

  it("choosing the custom window shows the custom-hours field and submits its value", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    const { container } = render(
      <CancellationPolicyForm action={action as never} initialValues={enabledPolicy} />,
    );

    await user.click(screen.getByRole("button", { name: CP.lateWindowOptions.custom }));
    const custom = screen.getByLabelText(CP.customHoursLabel);
    await user.type(custom, "36");
    expect(
      (container.querySelector('input[name="lateCancellationHours"]') as HTMLInputElement)
        .value,
    ).toBe("36");
  });

  it("initialises into the custom window when the saved hours is not a preset", () => {
    renderForm({ ...enabledPolicy, lateCancellationHours: 36 });
    // Custom field is visible and prefilled with 36.
    expect(screen.getByLabelText(CP.customHoursLabel)).toHaveValue(36);
  });

  it("selecting the fixed fee type reveals the amount field and submits it", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    const { container } = render(
      <CancellationPolicyForm action={action as never} initialValues={enabledPolicy} />,
    );

    await user.click(screen.getByRole("button", { name: CP.feeTypeFixed }));
    const amount = screen.getByLabelText(CP.feeAmountLabel);
    await user.type(amount, "50");
    expect(
      (container.querySelector('input[name="lateCancellationFeeType"]') as HTMLInputElement)
        .value,
    ).toBe("fixed");
    expect(amount).toHaveValue(50);
  });

  it("selecting the percentage fee type reveals the percentage field", async () => {
    const user = userEvent.setup();
    renderForm(enabledPolicy);
    await user.click(screen.getByRole("button", { name: CP.feeTypePercentage }));
    expect(screen.getByLabelText(CP.feePercentageLabel)).toBeInTheDocument();
  });

  it("the auto-generate button fills the policy text with a fixed-fee sentence", async () => {
    const user = userEvent.setup();
    renderForm({ ...enabledPolicy, policyText: "" });
    await user.click(screen.getByRole("button", { name: CP.feeTypeFixed }));
    await user.type(screen.getByLabelText(CP.feeAmountLabel), "50");
    await user.click(screen.getByRole("button", { name: CP.generateTextButton }));

    const textarea = screen.getByPlaceholderText(CP.policyTextPlaceholder);
    expect((textarea as HTMLTextAreaElement).value).toMatch(/24 שעות/);
    expect((textarea as HTMLTextAreaElement).value).toMatch(/₪50/);
  });

  it("auto-generate produces a percentage sentence when the fee type is percentage", async () => {
    const user = userEvent.setup();
    renderForm({ ...enabledPolicy, policyText: "" });
    await user.click(screen.getByRole("button", { name: CP.feeTypePercentage }));
    await user.type(screen.getByLabelText(CP.feePercentageLabel), "30");
    await user.click(screen.getByRole("button", { name: CP.generateTextButton }));
    expect(
      (screen.getByPlaceholderText(CP.policyTextPlaceholder) as HTMLTextAreaElement).value,
    ).toMatch(/30% ממחיר השירות/);
  });

  it("auto-generate falls back to a no-fee sentence when no hours are set (custom empty)", async () => {
    const user = userEvent.setup();
    renderForm(enabledPolicy);
    // Switch to custom but leave the field empty -> resolvedHours is undefined.
    await user.click(screen.getByRole("button", { name: CP.lateWindowOptions.custom }));
    await user.click(screen.getByRole("button", { name: CP.generateTextButton }));
    expect(
      (screen.getByPlaceholderText(CP.policyTextPlaceholder) as HTMLTextAreaElement).value,
    ).toMatch(/ניתן לבטל או לשנות תור עד 24 שעות לפני מועד התור/);
  });

  it("auto-generate omits the fee amount when a fee type is chosen but no amount is entered", async () => {
    const user = userEvent.setup();
    renderForm({ ...enabledPolicy, policyText: "" });
    // Choose fixed fee but leave the amount empty -> feeText is empty.
    await user.click(screen.getByRole("button", { name: CP.feeTypeFixed }));
    await user.click(screen.getByRole("button", { name: CP.generateTextButton }));
    const text = (
      screen.getByPlaceholderText(CP.policyTextPlaceholder) as HTMLTextAreaElement
    ).value;
    expect(text).toMatch(/עשוי לחייב דמי ביטול\./);
    expect(text).not.toMatch(/₪/);
  });

  it("submits the full enabled policy payload", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    renderForm(enabledPolicy, action);

    await user.click(screen.getByRole("button", { name: CP.saveButton }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    const fd = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.get("enabled")).toBe("true");
    expect(fd.get("lateCancellationHours")).toBe("24");
    expect(fd.get("lateCancellationFeeType")).toBe("none");
    expect(fd.get("policyText")).toBe("מדיניות קיימת");
  });

  it("renders a custom-hours validation error from the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({
      errors: { lateCancellationHours: SETTINGS.errors.minNoticeInvalid },
    }));
    render(
      <CancellationPolicyForm action={action as never} initialValues={{ ...enabledPolicy, lateCancellationHours: 36 }} />,
    );
    await user.click(screen.getByRole("button", { name: CP.saveButton }));
    expect(
      await screen.findByText(SETTINGS.errors.minNoticeInvalid),
    ).toBeInTheDocument();
  });

  it("renders form error and success from the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ formError: SETTINGS.errors.generic }));
    const { rerender } = render(
      <CancellationPolicyForm action={action as never} initialValues={enabledPolicy} />,
    );
    await user.click(screen.getByRole("button", { name: CP.saveButton }));
    expect(await screen.findByText(SETTINGS.errors.generic)).toBeInTheDocument();

    rerender(
      <CancellationPolicyForm
        action={(vi.fn(async () => ({ success: CP.success })) as never)}
        initialValues={enabledPolicy}
      />,
    );
  });

  it("renders the success message", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: CP.success }));
    renderForm(enabledPolicy, action);
    await user.click(screen.getByRole("button", { name: CP.saveButton }));
    expect(await screen.findByText(CP.success)).toBeInTheDocument();
  });
});
