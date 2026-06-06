"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingFormState } from "@/server/bookings/actions";

const INITIAL: BookingFormState = {};

export function BookingNotesForm({
  action,
  initialNotes,
}: {
  action: (
    prevState: BookingFormState,
    formData: FormData,
  ) => Promise<BookingFormState>;
  initialNotes: string;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-800 font-medium">
          {BOOKINGS.detail.notesSaved}
        </div>
      )}
      <Textarea
        id="notes"
        name="notes"
        placeholder={BOOKINGS.detail.notesPlaceholder}
        rows={3}
        defaultValue={state.values?.notes ?? initialNotes}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? BOOKINGS.detail.savingNotes : BOOKINGS.detail.saveNotes}
      </Button>
    </form>
  );
}
