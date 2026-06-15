import { describe, it, expect } from "vitest";
import {
  getPrimaryBookingAction,
  getBookingMenuActions,
  type BookingActionType,
} from "@/lib/bookings/row-actions";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

const ALL_STATUSES: BookingStatus[] = [
  "pending",
  "approved",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
];

describe("getPrimaryBookingAction", () => {
  it("offers 'אישור תור' as the primary action for pending bookings", () => {
    const primary = getPrimaryBookingAction("pending");
    expect(primary.type).toBe("approve");
    expect(primary.label).toBe(BOOKINGS.rowActions.approve);
    expect(primary.variant).toBe("primary");
    expect(primary.kind).toBe("action");
  });

  it("offers 'סימון כהושלם' as the primary action for approved bookings", () => {
    const primary = getPrimaryBookingAction("approved");
    expect(primary.type).toBe("complete");
    expect(primary.label).toBe(BOOKINGS.rowActions.complete);
    expect(primary.variant).toBe("primary");
  });

  it("falls back to a non-destructive 'צפייה' for terminal statuses", () => {
    for (const status of ["completed", "cancelled", "no_show", "rescheduled"] as BookingStatus[]) {
      const primary = getPrimaryBookingAction(status);
      expect(primary.type).toBe("view");
      expect(primary.kind).toBe("link");
      expect(primary.label).toBe(BOOKINGS.rowActions.viewShort);
    }
  });

  it("never returns a destructive action as the primary action", () => {
    for (const status of ALL_STATUSES) {
      expect(getPrimaryBookingAction(status).destructive).toBeFalsy();
    }
  });
});

describe("getBookingMenuActions", () => {
  it("includes complete, no-show, cancel and message for a pending booking (not approve — that's primary)", () => {
    const types = getBookingMenuActions("pending").map((a) => a.type);
    expect(types).toEqual(["view", "complete", "noShow", "cancel", "message"]);
    expect(types).not.toContain("approve");
  });

  it("offers no-show, cancel and message for an approved booking (not complete — that's primary)", () => {
    const types = getBookingMenuActions("approved").map((a) => a.type);
    expect(types).toEqual(["view", "noShow", "cancel", "message"]);
    expect(types).not.toContain("complete");
  });

  it("offers message + review request for a completed booking, and no status-transition actions", () => {
    const types = getBookingMenuActions("completed").map((a) => a.type);
    expect(types).toEqual(["message", "review"]);
    for (const invalid of ["approve", "complete", "noShow", "cancel"] as BookingActionType[]) {
      expect(types).not.toContain(invalid);
    }
  });

  it("only offers a safe message action for cancelled / no-show / rescheduled bookings", () => {
    for (const status of ["cancelled", "no_show", "rescheduled"] as BookingStatus[]) {
      const types = getBookingMenuActions(status).map((a) => a.type);
      expect(types).toEqual(["message"]);
      expect(types).not.toContain("cancel");
      expect(types).not.toContain("noShow");
    }
  });

  it("marks ביטול and אי־הגעה as destructive and requires confirmation copy for them", () => {
    const menu = getBookingMenuActions("approved");
    const cancel = menu.find((a) => a.type === "cancel");
    const noShow = menu.find((a) => a.type === "noShow");

    expect(cancel?.destructive).toBe(true);
    expect(cancel?.confirm?.title).toBe(BOOKINGS.rowActions.confirmCancel.title);
    expect(cancel?.confirm?.confirmLabel).toBe(BOOKINGS.rowActions.confirmCancel.confirm);

    expect(noShow?.destructive).toBe(true);
    expect(noShow?.confirm?.title).toBe(BOOKINGS.rowActions.confirmNoShow.title);
    expect(noShow?.confirm?.confirmLabel).toBe(BOOKINGS.rowActions.confirmNoShow.confirm);
  });

  it("does not require confirmation for non-destructive actions", () => {
    for (const status of ALL_STATUSES) {
      for (const action of getBookingMenuActions(status)) {
        if (!action.destructive) expect(action.confirm).toBeUndefined();
      }
    }
  });

  it("gives every menu item a non-empty text label", () => {
    for (const status of ALL_STATUSES) {
      for (const action of getBookingMenuActions(status)) {
        expect(action.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
