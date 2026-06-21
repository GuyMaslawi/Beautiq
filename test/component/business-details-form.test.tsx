// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BusinessDetailsForm } from "@/components/settings/business-details-form";
import { SETTINGS } from "@/lib/constants/he";

const FULL = {
  name: "הסטודיו של יעל",
  phone: "050-1234567",
  city: "תל אביב",
  description: "סטודיו לטיפוח",
  addressNote: "קומה 2",
};

const EMPTY = {
  name: "",
  phone: null,
  city: null,
  description: null,
  addressNote: null,
};

function renderForm(
  initialValues: Parameters<typeof BusinessDetailsForm>[0]["initialValues"],
  action = vi.fn(async () => ({})),
) {
  render(
    <BusinessDetailsForm action={action as never} initialValues={initialValues} />,
  );
  return { action };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BusinessDetailsForm", () => {
  it("renders every labelled field and the save button", () => {
    renderForm(EMPTY);
    expect(
      screen.getByLabelText(SETTINGS.businessDetails.nameLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(SETTINGS.businessDetails.phoneLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(SETTINGS.businessDetails.cityLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(SETTINGS.businessDetails.descriptionLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(SETTINGS.businessDetails.addressNoteLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: SETTINGS.businessDetails.saveButton }),
    ).toBeInTheDocument();
  });

  it("prefills inputs from initialValues, coalescing nulls to empty strings", () => {
    renderForm(FULL);
    expect(screen.getByLabelText(SETTINGS.businessDetails.nameLabel)).toHaveValue(
      "הסטודיו של יעל",
    );
    expect(screen.getByLabelText(SETTINGS.businessDetails.phoneLabel)).toHaveValue(
      "050-1234567",
    );
    expect(screen.getByLabelText(SETTINGS.businessDetails.cityLabel)).toHaveValue(
      "תל אביב",
    );
  });

  it("renders empty strings when nullable fields are null", () => {
    renderForm(EMPTY);
    expect(screen.getByLabelText(SETTINGS.businessDetails.phoneLabel)).toHaveValue("");
    expect(screen.getByLabelText(SETTINGS.businessDetails.cityLabel)).toHaveValue("");
  });

  it("typing updates controlled inputs and submitting sends the values", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    renderForm(EMPTY, action);

    const name = screen.getByLabelText(SETTINGS.businessDetails.nameLabel);
    await user.type(name, "סלון חדש");
    expect(name).toHaveValue("סלון חדש");
    await user.type(
      screen.getByLabelText(SETTINGS.businessDetails.phoneLabel),
      "0501112222",
    );
    await user.type(
      screen.getByLabelText(SETTINGS.businessDetails.cityLabel),
      "חיפה",
    );
    await user.type(
      screen.getByLabelText(SETTINGS.businessDetails.descriptionLabel),
      "תיאור",
    );
    await user.type(
      screen.getByLabelText(SETTINGS.businessDetails.addressNoteLabel),
      "כתובת",
    );

    await user.click(
      screen.getByRole("button", { name: SETTINGS.businessDetails.saveButton }),
    );
    await waitFor(() => expect(action).toHaveBeenCalled());
    const fd = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.get("name")).toBe("סלון חדש");
    expect(fd.get("phone")).toBe("0501112222");
    expect(fd.get("city")).toBe("חיפה");
    expect(fd.get("description")).toBe("תיאור");
    expect(fd.get("addressNote")).toBe("כתובת");
  });

  it("renders a field error returned for name", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({
      errors: { name: SETTINGS.errors.nameRequired },
    }));
    renderForm(EMPTY, action);
    await user.click(
      screen.getByRole("button", { name: SETTINGS.businessDetails.saveButton }),
    );
    expect(
      await screen.findByText(SETTINGS.errors.nameRequired),
    ).toBeInTheDocument();
  });

  it("renders the form-level error and the success message", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ formError: SETTINGS.errors.generic }));
    const { rerender } = render(
      <BusinessDetailsForm action={action as never} initialValues={EMPTY} />,
    );
    await user.click(
      screen.getByRole("button", { name: SETTINGS.businessDetails.saveButton }),
    );
    expect(await screen.findByText(SETTINGS.errors.generic)).toBeInTheDocument();

    rerender(
      <BusinessDetailsForm
        action={(vi.fn(async () => ({ success: SETTINGS.businessDetails.success })) as never)}
        initialValues={EMPTY}
      />,
    );
  });

  it("renders the success message from the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: SETTINGS.businessDetails.success }));
    renderForm(EMPTY, action);
    await user.click(
      screen.getByRole("button", { name: SETTINGS.businessDetails.saveButton }),
    );
    expect(
      await screen.findByText(SETTINGS.businessDetails.success),
    ).toBeInTheDocument();
  });
});
