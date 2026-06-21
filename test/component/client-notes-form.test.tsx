// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientNotesForm } from "@/components/clients/client-notes-form";
import { CLIENTS } from "@/lib/constants/he";
import type { ClientNotesFormState } from "@/server/clients/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClientNotesForm", () => {
  it("renders the textarea with default notes and the save button", () => {
    const action = vi.fn(async () => ({}));
    render(<ClientNotesForm action={action} initialNotes="אלרגיה ללטקס" />);

    const textarea = screen.getByPlaceholderText(CLIENTS.detail.notesPlaceholder);
    expect(textarea).toHaveValue("אלרגיה ללטקס");
    expect(screen.getByRole("button", { name: CLIENTS.detail.saveNotes })).toBeInTheDocument();
  });

  it("submits the form and calls the bound action", async () => {
    const action = vi.fn(async (): Promise<ClientNotesFormState> => ({ success: true }));
    render(<ClientNotesForm action={action} initialNotes="" />);

    await userEvent.click(screen.getByRole("button", { name: CLIENTS.detail.saveNotes }));
    await waitFor(() => expect(action).toHaveBeenCalled());
  });

  it("shows the saved confirmation when the action returns success", async () => {
    const action = vi.fn(async (): Promise<ClientNotesFormState> => ({ success: true }));
    render(<ClientNotesForm action={action} initialNotes="" />);

    await userEvent.click(screen.getByRole("button", { name: CLIENTS.detail.saveNotes }));
    expect(await screen.findByText(CLIENTS.detail.notesSaved)).toBeInTheDocument();
  });

  it("shows a form error alert when the action returns one", async () => {
    const action = vi.fn(
      async (): Promise<ClientNotesFormState> => ({ formError: "שמירה נכשלה" }),
    );
    render(<ClientNotesForm action={action} initialNotes="" />);

    await userEvent.click(screen.getByRole("button", { name: CLIENTS.detail.saveNotes }));
    expect(await screen.findByText("שמירה נכשלה")).toBeInTheDocument();
  });
});
