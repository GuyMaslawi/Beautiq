"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Renders the confirm button in red and announces a destructive action. */
  destructive?: boolean;
  /** Disables the buttons while the underlying action is running. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small, accessible confirmation dialog used for destructive booking actions
 * (cancel, no-show). RTL-first and built on the app's existing modal styling —
 * no native window.confirm.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(43,37,48,0.45)" }}
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            dir="rtl"
            className="relative w-full max-w-sm rounded-2xl p-5 text-right"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(43,37,48,0.18), 0 2px 8px rgba(43,37,48,0.10)",
            }}
          >
            <h2 className="text-foreground text-lg font-bold">{title}</h2>
            {description && (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                {description}
              </p>
            )}

            <div className="mt-5 flex flex-row-reverse gap-2">
              <Button
                autoFocus
                size="sm"
                variant={destructive ? "destructive" : "primary"}
                disabled={pending}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
                {cancelLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
