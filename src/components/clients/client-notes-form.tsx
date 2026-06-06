"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CLIENTS } from "@/lib/constants/he";
import type { ClientNotesFormState } from "@/server/clients/actions";

const INITIAL: ClientNotesFormState = {};

export function ClientNotesForm({
  action,
  initialNotes,
}: {
  action: (
    prevState: ClientNotesFormState,
    formData: FormData,
  ) => Promise<ClientNotesFormState>;
  initialNotes: string;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800">
          {CLIENTS.detail.notesSaved}
        </div>
      )}
      <Textarea
        name="notes"
        placeholder={CLIENTS.detail.notesPlaceholder}
        rows={3}
        defaultValue={initialNotes}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? CLIENTS.detail.savingNotes : CLIENTS.detail.saveNotes}
      </Button>
    </form>
  );
}
