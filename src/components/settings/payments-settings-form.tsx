"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PAYMENTS } from "@/lib/constants/he";
import type {
  PaymentSettingsFormState,
  updatePaymentSettingsAction,
} from "@/server/payments/actions";
import type { PaymentSettingsData } from "@/server/payments/settings";

const INITIAL: PaymentSettingsFormState = {};

const PROVIDERS = ["mock", "payplus", "grow_meshulam", "tranzila", "disabled"] as const;
const REQUIREMENTS = ["none", "deposit", "full_payment"] as const;
const DEPOSIT_TYPES = ["fixed_amount", "percentage"] as const;

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
      style={
        active
          ? {
              background: "rgba(184,107,140,0.12)",
              borderColor: "#b86b8c",
              color: "#b86b8c",
              fontWeight: 600,
            }
          : { borderColor: "var(--border)", color: "var(--foreground-soft)" }
      }
    >
      {children}
    </button>
  );
}

export function PaymentsSettingsForm({
  action,
  initialValues,
  connectionStatus,
}: {
  action: typeof updatePaymentSettingsAction;
  initialValues: PaymentSettingsData;
  connectionStatus: "mock" | "active" | "not_connected" | "error";
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const [enabled, setEnabled] = useState(initialValues.enabled);
  const [provider, setProvider] = useState(initialValues.provider);
  const [requirement, setRequirement] = useState(initialValues.requirement);
  const [depositType, setDepositType] = useState(initialValues.depositType);
  const [depositAmount, setDepositAmount] = useState(initialValues.depositAmount);
  const [depositPercentage, setDepositPercentage] = useState(
    initialValues.depositPercentage,
  );
  const [allowPayAtBusiness, setAllowPayAtBusiness] = useState(
    initialValues.allowPayAtBusiness,
  );

  const showNotConnected =
    enabled && provider !== "mock" && connectionStatus !== "active";

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <p className="text-muted text-sm leading-relaxed">
        {PAYMENTS.settings.sectionHint}
      </p>

      {/* Enable toggle */}
      <div className="space-y-1">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            value="true"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 rounded accent-primary"
          />
          <span className="text-foreground font-semibold">
            {PAYMENTS.settings.enableLabel}
          </span>
        </label>
        <p className="text-muted pr-8 text-xs leading-relaxed">
          {PAYMENTS.settings.enableHint}
        </p>
      </div>

      {enabled && (
        <div className="space-y-5 rounded-xl border border-[var(--border)] p-4">
          {/* Not-connected notice */}
          {showNotConnected && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(184,150,10,0.08)",
                color: "#7a6400",
                border: "1px solid rgba(184,150,10,0.22)",
              }}
            >
              <p className="font-semibold">
                {PAYMENTS.settings.notConnectedTitle}
              </p>
              <p className="mt-1 leading-relaxed">
                {PAYMENTS.settings.notConnectedBody}
              </p>
            </div>
          )}

          {/* Provider */}
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">
              {PAYMENTS.settings.providerLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <Pill key={p} active={provider === p} onClick={() => setProvider(p)}>
                  {PAYMENTS.settings.provider[p]}
                </Pill>
              ))}
            </div>
            <input type="hidden" name="provider" value={provider} />
          </div>

          {/* Requirement */}
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">
              {PAYMENTS.settings.requirementLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {REQUIREMENTS.map((r) => (
                <Pill
                  key={r}
                  active={requirement === r}
                  onClick={() => setRequirement(r)}
                >
                  {PAYMENTS.settings.requirement[r]}
                </Pill>
              ))}
            </div>
            <input type="hidden" name="requirement" value={requirement} />
          </div>

          {/* Deposit config — only when requirement = deposit */}
          {requirement === "deposit" && (
            <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
              <div className="space-y-2">
                <p className="text-foreground text-sm font-medium">
                  {PAYMENTS.settings.depositTypeLabel}
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEPOSIT_TYPES.map((t) => (
                    <Pill
                      key={t}
                      active={depositType === t}
                      onClick={() => setDepositType(t)}
                    >
                      {PAYMENTS.settings.depositType[t]}
                    </Pill>
                  ))}
                </div>
                <input type="hidden" name="depositType" value={depositType} />
              </div>

              {depositType === "fixed_amount" ? (
                <Field
                  label={PAYMENTS.settings.depositAmountLabel}
                  htmlFor="depositAmount"
                  error={state.errors?.depositAmount}
                >
                  <Input
                    id="depositAmount"
                    name="depositAmount"
                    type="number"
                    min="0"
                    step="1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-36"
                  />
                </Field>
              ) : (
                <Field
                  label={PAYMENTS.settings.depositPercentageLabel}
                  htmlFor="depositPercentage"
                  error={state.errors?.depositPercentage}
                >
                  <Input
                    id="depositPercentage"
                    name="depositPercentage"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={depositPercentage}
                    onChange={(e) => setDepositPercentage(e.target.value)}
                    className="w-36"
                  />
                </Field>
              )}
            </div>
          )}
          {/* Always submit both fields so values round-trip */}
          {requirement !== "deposit" && (
            <>
              <input type="hidden" name="depositType" value={depositType} />
              <input type="hidden" name="depositAmount" value={depositAmount} />
              <input
                type="hidden"
                name="depositPercentage"
                value={depositPercentage}
              />
            </>
          )}
          {requirement === "deposit" && depositType === "fixed_amount" && (
            <input
              type="hidden"
              name="depositPercentage"
              value={depositPercentage}
            />
          )}
          {requirement === "deposit" && depositType === "percentage" && (
            <input type="hidden" name="depositAmount" value={depositAmount} />
          )}

          {/* Allow pay at business */}
          <div className="space-y-1">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="allowPayAtBusiness"
                value="true"
                checked={allowPayAtBusiness}
                onChange={(e) => setAllowPayAtBusiness(e.target.checked)}
                className="h-5 w-5 rounded accent-primary"
              />
              <span className="text-foreground font-medium">
                {PAYMENTS.settings.allowPayAtBusinessLabel}
              </span>
            </label>
            <p className="text-muted pr-8 text-xs leading-relaxed">
              {PAYMENTS.settings.allowPayAtBusinessHint}
            </p>
          </div>

          {/* Instructions */}
          <Field
            label={PAYMENTS.settings.instructionsLabel}
            htmlFor="instructions"
          >
            <Textarea
              id="instructions"
              name="instructions"
              rows={2}
              placeholder={PAYMENTS.settings.instructionsPlaceholder}
              defaultValue={initialValues.instructions}
            />
          </Field>
        </div>
      )}

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {PAYMENTS.settings.save}
      </Button>
    </form>
  );
}
