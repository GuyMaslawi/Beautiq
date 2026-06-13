"use client";

import { useState, useActionState } from "react";
import { MessageCircle } from "lucide-react";
import { updateClientOptInAction } from "@/server/clients/actions";
import type { UpdateClientOptInState } from "@/server/clients/actions";
import { CLIENTS } from "@/lib/constants/he";

const c = CLIENTS.detail;

interface Props {
  clientId: string;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
}

const initialState: UpdateClientOptInState = {};

export function ClientOptInForm({ clientId, whatsappOptIn, marketingOptIn }: Props) {
  const boundAction = updateClientOptInAction.bind(null, clientId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  const [localWhatsapp, setLocalWhatsapp] = useState(whatsappOptIn);
  const [localMarketing, setLocalMarketing] = useState(marketingOptIn);

  // Sync controlled state when the server component re-renders with updated DB
  // values, adjusting during render instead of in an effect to avoid a
  // cascading-render setState-in-effect.
  const [prevProps, setPrevProps] = useState({ whatsappOptIn, marketingOptIn });
  if (
    prevProps.whatsappOptIn !== whatsappOptIn ||
    prevProps.marketingOptIn !== marketingOptIn
  ) {
    setPrevProps({ whatsappOptIn, marketingOptIn });
    setLocalWhatsapp(whatsappOptIn);
    setLocalMarketing(marketingOptIn);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#b86b8c" }} />
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          {c.optInSection}
        </p>
      </div>

      <p className="text-muted text-xs leading-5">{c.optInHelper}</p>

      <form action={formAction} className="space-y-3">
        <OptInRow
          name="whatsappOptIn"
          label={c.whatsappOptInLabel}
          checked={localWhatsapp}
          onCheckedChange={setLocalWhatsapp}
          color="#16a34a"
        />
        <OptInRow
          name="marketingOptIn"
          label={c.marketingOptInLabel}
          checked={localMarketing}
          onCheckedChange={setLocalMarketing}
          color="#3b7ab5"
        />

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            }}
          >
            {isPending ? c.optInSaving : c.optInSave}
          </button>

          {state.success && (
            <span className="text-xs font-medium" style={{ color: "#16a34a" }}>
              ✓ {c.optInSaved}
            </span>
          )}
          {state.error && (
            <span className="text-xs font-medium" style={{ color: "#dc2626" }}>
              {state.error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function OptInRow({
  name,
  label,
  checked,
  onCheckedChange,
  color,
}: {
  name: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        value="true"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded"
        style={{ accentColor: color }}
      />
      <span className="text-sm leading-5" style={{ color: "var(--foreground-soft)" }}>
        {label}
      </span>
    </label>
  );
}
