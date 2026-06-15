"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  approveBookingAction,
  completeBookingAction,
  cancelBookingAction,
  noShowBookingAction,
} from "@/server/bookings/actions";
import {
  getPrimaryBookingAction,
  getBookingMenuActions,
  type BookingAction,
  type BookingActionType,
} from "@/lib/bookings/row-actions";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

type ServerActionType = "approve" | "complete" | "noShow" | "cancel";

/**
 * Unified booking actions UI: one clear primary button + a "פעולות" menu of
 * text-labeled secondary actions. Replaces the old strip of unlabeled icons on
 * both the desktop table row and the mobile booking card.
 *
 * - `layout="row"` → compact desktop table cell, menu trigger reads "פעולות".
 * - `layout="card"` → mobile card footer, menu trigger is a three-dots button.
 */
export function BookingActionsMenu({
  bookingId,
  status,
  layout = "row",
}: {
  bookingId: string;
  status: BookingStatus;
  layout?: "row" | "card";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BookingAction | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const primary = getPrimaryBookingAction(status);
  const menuActions = getBookingMenuActions(status);

  const serverActions: Record<ServerActionType, () => Promise<void>> = {
    approve: () => approveBookingAction(bookingId),
    complete: () => completeBookingAction(bookingId),
    noShow: () => noShowBookingAction(bookingId),
    cancel: () => cancelBookingAction(bookingId),
  };

  function isServerAction(type: BookingActionType): type is ServerActionType {
    return type === "approve" || type === "complete" || type === "noShow" || type === "cancel";
  }

  function runServerAction(type: ServerActionType) {
    startTransition(() => serverActions[type]());
  }

  // Dispatch an action: navigate for links, confirm-then-run for destructive
  // actions, run immediately otherwise.
  function dispatch(action: BookingAction) {
    setMenuOpen(false);
    if (action.kind === "link") {
      router.push(`/bookings/${bookingId}`);
      return;
    }
    if (action.confirm) {
      setConfirmAction(action);
      return;
    }
    if (isServerAction(action.type)) runServerAction(action.type);
  }

  function confirmAndRun() {
    if (confirmAction && isServerAction(confirmAction.type)) {
      runServerAction(confirmAction.type);
    }
    setConfirmAction(null);
  }

  // Close the menu on click-outside.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close the menu on Escape and return focus to the trigger.
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  const isCompact = layout === "card";

  return (
    <div
      className={
        isCompact
          ? "flex items-center gap-2 px-4 py-3"
          : "flex items-center justify-end gap-2"
      }
      style={
        isCompact
          ? { borderTop: "1px solid var(--border)", background: "rgba(43,37,48,0.02)" }
          : undefined
      }
    >
      {/* Primary contextual action */}
      <Button
        size="sm"
        variant={primary.variant === "primary" ? "primary" : "secondary"}
        disabled={isPending}
        className={isCompact ? "flex-1" : undefined}
        onClick={() => dispatch(primary)}
      >
        {primary.label}
      </Button>

      {/* "פעולות" menu */}
      {menuActions.length > 0 && (
        <div className="relative" ref={containerRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={isPending}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            // Icon-only compact trigger needs an explicit label; the row trigger's
            // visible "פעולות" text already serves as its accessible name.
            aria-label={isCompact ? BOOKINGS.rowActions.moreCompact : undefined}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-all hover:bg-background-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted)",
              ["--tw-ring-color" as string]: "#b86b8c",
            }}
          >
            {isCompact ? (
              <MoreHorizontal className="h-4 w-4" />
            ) : (
              <>
                <span>{BOOKINGS.rowActions.more}</span>
                <ChevronDown
                  className="h-3.5 w-3.5 transition-transform duration-200"
                  style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </>
            )}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                dir="rtl"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="absolute z-50 mt-2 w-52 overflow-hidden rounded-2xl py-1.5"
                style={{
                  insetInlineEnd: 0,
                  top: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 8px 32px rgba(43,37,48,0.14), 0 2px 8px rgba(43,37,48,0.08)",
                }}
              >
                {menuActions.map((action) => (
                  <button
                    key={action.type}
                    type="button"
                    role="menuitem"
                    disabled={isPending}
                    onClick={() => dispatch(action)}
                    className="block w-full px-4 py-2.5 text-right text-sm font-medium transition-colors hover:bg-background-alt focus-visible:bg-background-alt focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ color: action.destructive ? "#dc2626" : "var(--foreground)" }}
                  >
                    {action.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Confirmation for destructive actions */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.confirm?.title ?? ""}
        description={confirmAction?.confirm?.description}
        confirmLabel={confirmAction?.confirm?.confirmLabel ?? ""}
        cancelLabel={confirmAction?.confirm?.cancelLabel ?? ""}
        destructive
        pending={isPending}
        onConfirm={confirmAndRun}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
