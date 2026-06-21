// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  isPending: false,
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [h.state, vi.fn(), h.isPending] as const,
  };
});

import { PublicProfileForm } from "@/components/public-page/public-profile-form";
import { PUBLIC_PAGE } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
  h.state = {};
  h.isPending = false;
});

const action = vi.fn(async () => ({}));

type InitialValues = Parameters<
  typeof PublicProfileForm
>[0]["initialValues"];

const FULL: InitialValues = {
  name: "סטודיו יופי",
  description: "מספרה",
  phone: "050-1234567",
  addressNote: "תל אביב",
  instagramUrl: "https://instagram.com/x",
  facebookUrl: "https://facebook.com/x",
  introMessage: "ברוכה הבאה",
};

const EMPTY: InitialValues = {
  name: "",
  description: null,
  phone: null,
  addressNote: null,
  instagramUrl: null,
  facebookUrl: null,
  introMessage: null,
};

function renderForm(initialValues: InitialValues = FULL) {
  return render(
    <PublicProfileForm action={action} initialValues={initialValues} />,
  );
}

describe("PublicProfileForm", () => {
  it("renders all labelled fields with initial values populated", () => {
    renderForm();
    expect(screen.getByText(PUBLIC_PAGE.profile.nameLabel)).toBeInTheDocument();
    expect(
      screen.getByText(PUBLIC_PAGE.profile.descriptionLabel),
    ).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.profile.phoneLabel)).toBeInTheDocument();
    expect(
      screen.getByText(PUBLIC_PAGE.profile.addressLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByText(PUBLIC_PAGE.profile.instagramLabel),
    ).toBeInTheDocument();
    expect(screen.getByText("פייסבוק (קישור)")).toBeInTheDocument();

    expect((document.getElementById("name") as HTMLInputElement).value).toBe(
      "סטודיו יופי",
    );
    expect(
      (document.getElementById("introMessage") as HTMLTextAreaElement).value,
    ).toBe("ברוכה הבאה");
  });

  it("coerces null initial values into empty fields (no 'null' leaks)", () => {
    renderForm(EMPTY);
    expect((document.getElementById("phone") as HTMLInputElement).value).toBe(
      "",
    );
    expect(
      (document.getElementById("description") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("updates a controlled field as the user types", async () => {
    renderForm(EMPTY);
    const name = document.getElementById("name") as HTMLInputElement;
    await userEvent.type(name, "מכון חדש");
    expect(name.value).toBe("מכון חדש");
  });

  it("shows a field-level error for the name", () => {
    h.state = { errors: { name: "שם חובה" } };
    renderForm(EMPTY);
    expect(screen.getByText("שם חובה")).toBeInTheDocument();
  });

  it("shows the form-level error and the success message", () => {
    h.state = { formError: "שמירה נכשלה", success: PUBLIC_PAGE.profile.success };
    renderForm();
    expect(screen.getByText("שמירה נכשלה")).toBeInTheDocument();
    expect(
      screen.getByText(PUBLIC_PAGE.profile.success),
    ).toBeInTheDocument();
  });

  it("disables the submit button and shows the saving label while pending", () => {
    h.isPending = true;
    renderForm();
    const btn = screen.getByRole("button", {
      name: PUBLIC_PAGE.profile.saving,
    });
    expect(btn).toBeDisabled();
  });
});
