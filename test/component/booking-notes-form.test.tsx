// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingNotesForm } from "@/components/bookings/booking-notes-form";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingFormState } from "@/server/bookings/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingNotesForm", () => {
  it("renders the textarea with the initial notes and the save button", () => {
    const action = vi.fn(async () => ({}) as BookingFormState);
    render(<BookingNotesForm action={action} initialNotes="לשים מוזיקה רגועה" />);

    const textarea = screen.getByPlaceholderText(
      BOOKINGS.detail.notesPlaceholder,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("לשים מוזיקה רגועה");
    expect(
      screen.getByRole("button", { name: BOOKINGS.detail.saveNotes }),
    ).toBeInTheDocument();
  });

  it("submits the form and calls the server action with the notes field", async () => {
    const user = userEvent.setup();
    const action = vi.fn<
      (prev: BookingFormState, fd: FormData) => Promise<BookingFormState>
    >(async () => ({ success: true }));
    render(<BookingNotesForm action={action} initialNotes="הערה" />);

    await user.click(
      screen.getByRole("button", { name: BOOKINGS.detail.saveNotes }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("notes")).toBe("הערה");
  });

  it("shows the success confirmation when the action reports success", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: true }) as BookingFormState);
    render(<BookingNotesForm action={action} initialNotes="" />);

    await user.click(
      screen.getByRole("button", { name: BOOKINGS.detail.saveNotes }),
    );
    await waitFor(() =>
      expect(screen.getByText(BOOKINGS.detail.notesSaved)).toBeInTheDocument(),
    );
  });

  it("shows the form error and re-fills the value from server state", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          formError: "שגיאה כללית",
          values: { notes: "ערך שחזר מהשרת" },
        }) as BookingFormState,
    );
    render(<BookingNotesForm action={action} initialNotes="התחלתי" />);

    await user.click(
      screen.getByRole("button", { name: BOOKINGS.detail.saveNotes }),
    );

    await waitFor(() =>
      expect(screen.getByText("שגיאה כללית")).toBeInTheDocument(),
    );
    const textarea = screen.getByPlaceholderText(
      BOOKINGS.detail.notesPlaceholder,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("ערך שחזר מהשרת");
  });
});
