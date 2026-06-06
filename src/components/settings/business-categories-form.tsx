"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SETTINGS } from "@/lib/constants/he";
import type { CategoriesFormState } from "@/server/settings/actions";
import type { updateBusinessCategoriesAction } from "@/server/settings/actions";
import type { BusinessCategoryData } from "@/server/settings/queries";

const INITIAL: CategoriesFormState = {};

export function BusinessCategoriesForm({
  action,
  allCategories,
  selectedIds,
}: {
  action: typeof updateBusinessCategoriesAction;
  allCategories: BusinessCategoryData[];
  selectedIds: string[];
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <p className="text-muted text-sm leading-relaxed">
        {SETTINGS.categories.hint}
      </p>

      {selected
        ? Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="categoryIds" value={id} />
          ))
        : null}

      <div className="flex flex-wrap gap-3">
        {allCategories.map((cat) => {
          const isSelected = selected.has(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat.id)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-foreground hover:border-primary/50",
              ].join(" ")}
            >
              {cat.nameHe}
            </button>
          );
        })}
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending
          ? SETTINGS.categories.saving
          : SETTINGS.categories.saveButton}
      </Button>
    </form>
  );
}
