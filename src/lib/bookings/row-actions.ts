import { BOOKINGS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

/**
 * Booking row action model.
 *
 * The Bookings table used to render a strip of unlabeled icons per row. This
 * module centralizes the decision of *which* actions are valid for a booking and
 * *how* each should behave, so the UI can render a single clear primary button
 * plus a "פעולות" menu of text-labeled items.
 *
 * Pure and side-effect free on purpose — easy to unit test. The client component
 * maps each action `type` to the matching server action / navigation.
 */

export type BookingActionType =
  | "view"
  | "complete"
  | "noShow"
  | "cancel"
  | "message"
  | "review";

export interface BookingActionConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface BookingAction {
  type: BookingActionType;
  label: string;
  /** "link" navigates to the booking detail page; "action" runs a server action. */
  kind: "link" | "action";
  /** Visual variant for the primary button (ignored for menu items). */
  variant?: "primary" | "secondary";
  /** Destructive menu items are tinted red. */
  destructive?: boolean;
  /** When present, the action must be confirmed in a dialog before it runs. */
  confirm?: BookingActionConfirm;
}

const A = BOOKINGS.rowActions;

const cancelConfirm: BookingActionConfirm = {
  title: A.confirmCancel.title,
  description: A.confirmCancel.description,
  confirmLabel: A.confirmCancel.confirm,
  cancelLabel: A.confirmCancel.cancel,
};

const noShowConfirm: BookingActionConfirm = {
  title: A.confirmNoShow.title,
  description: A.confirmNoShow.description,
  confirmLabel: A.confirmNoShow.confirm,
  cancelLabel: A.confirmNoShow.cancel,
};

const viewItem: BookingAction = { type: "view", label: A.view, kind: "link" };
const messageItem: BookingAction = { type: "message", label: A.message, kind: "link" };
const reviewItem: BookingAction = { type: "review", label: A.review, kind: "link" };
const noShowItem: BookingAction = {
  type: "noShow",
  label: A.noShow,
  kind: "action",
  destructive: true,
  confirm: noShowConfirm,
};
const cancelItem: BookingAction = {
  type: "cancel",
  label: A.cancel,
  kind: "action",
  destructive: true,
  confirm: cancelConfirm,
};

/**
 * The single most relevant action for a booking, rendered as a prominent button.
 * Never returns a destructive action (those live in the menu behind a confirm).
 */
export function getPrimaryBookingAction(status: BookingStatus): BookingAction {
  switch (status) {
    case "pending":
    case "approved":
      return { type: "complete", label: A.complete, kind: "action", variant: "primary" };
    case "completed":
    case "cancelled":
    case "no_show":
    case "rescheduled":
    default:
      // Terminal states: nothing to do but look — fall back to a calm "צפייה".
      return { type: "view", label: A.viewShort, kind: "link", variant: "secondary" };
  }
}

/**
 * The secondary actions shown inside the "פעולות" menu. Only valid actions for
 * the given status are returned — invalid actions are omitted, never disabled.
 * The primary action is never duplicated here.
 */
export function getBookingMenuActions(status: BookingStatus): BookingAction[] {
  switch (status) {
    case "pending":
    case "approved":
      // Primary = complete.
      return [viewItem, noShowItem, cancelItem, messageItem];
    case "completed":
      // Primary = view. Offer follow-up messaging + a review request.
      return [messageItem, reviewItem];
    case "cancelled":
    case "no_show":
    case "rescheduled":
      // Primary = view. Only a safe rebook/follow-up message remains.
      return [messageItem];
    default:
      return [];
  }
}
