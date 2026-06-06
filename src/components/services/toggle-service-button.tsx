"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleServiceActiveAction } from "@/server/services/actions";
import { SERVICES } from "@/lib/constants/he";

export function ToggleServiceButton({
  serviceId,
  isActive,
}: {
  serviceId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(() => toggleServiceActiveAction(serviceId, !isActive))
      }
    >
      {isActive ? SERVICES.card.deactivateButton : SERVICES.card.activateButton}
    </Button>
  );
}
