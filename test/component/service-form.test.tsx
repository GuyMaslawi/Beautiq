// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceForm } from "@/components/services/service-form";
import { SERVICES } from "@/lib/constants/he";
import type { ServiceFormState } from "@/server/services/actions";
import React from "react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...rest }, children),
}));

function noop() {
  return vi.fn(async () => ({}) as ServiceFormState);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ServiceForm — create mode", () => {
  it("renders the price, details and advanced sections", () => {
    render(<ServiceForm action={noop()} />);
    expect(screen.getByText(SERVICES.form.sectionPriceAndTime)).toBeInTheDocument();
    expect(screen.getByText(SERVICES.form.sectionBasic)).toBeInTheDocument();
    expect(screen.getByText(SERVICES.form.sectionAdvanced)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(SERVICES.form.saveButton) }),
    ).toBeInTheDocument();
  });

  it("does not render the active-status toggle card in create mode", () => {
    render(<ServiceForm action={noop()} />);
    expect(screen.queryByText("סטטוס השירות")).not.toBeInTheDocument();
  });

  it("submits and forwards the typed field values to the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn<
      (prev: ServiceFormState, fd: FormData) => Promise<ServiceFormState>
    >(async () => ({}));
    render(<ServiceForm action={action} />);

    await user.type(screen.getByLabelText(SERVICES.form.nameLabel), "לק ג'ל");
    await user.selectOptions(
      screen.getByLabelText(SERVICES.form.durationLabel),
      "60",
    );
    await user.type(screen.getByLabelText(SERVICES.form.priceLabel), "180");

    await user.click(
      screen.getByRole("button", { name: new RegExp(SERVICES.form.saveButton) }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][1];
    expect(fd.get("name")).toBe("לק ג'ל");
    expect(fd.get("durationMinutes")).toBe("60");
    expect(fd.get("price")).toBe("180");
  });

  it("updates the description character counter as the user types", async () => {
    const user = userEvent.setup();
    render(<ServiceForm action={noop()} />);
    await user.type(screen.getByLabelText(SERVICES.form.descriptionLabel), "שלום");
    expect(screen.getByText("4/180")).toBeInTheDocument();
  });
});

describe("ServiceForm — edit mode", () => {
  it("prefills values and shows the status toggle + edit save label", () => {
    render(
      <ServiceForm
        action={noop()}
        isEdit
        initialValues={{
          name: "פדיקור",
          durationMinutes: 90,
          price: "200",
          isActive: true,
        }}
      />,
    );
    expect((screen.getByLabelText(SERVICES.form.nameLabel) as HTMLInputElement).value).toBe(
      "פדיקור",
    );
    expect(screen.getByText("סטטוס השירות")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(SERVICES.form.saveEditButton),
      }),
    ).toBeInTheDocument();
  });

  it("renders a custom-duration option when the initial value is not a preset", () => {
    render(
      <ServiceForm
        action={noop()}
        isEdit
        initialValues={{ durationMinutes: 25 }}
      />,
    );
    const select = screen.getByLabelText(
      SERVICES.form.durationLabel,
    ) as HTMLSelectElement;
    expect(select.value).toBe("25");
    expect(screen.getByText("25 דקות")).toBeInTheDocument();
  });

  it("toggles the active status switch and writes the hidden input", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({}) as ServiceFormState);
    const { container } = render(
      <ServiceForm
        action={action}
        isEdit
        initialValues={{ name: "x", durationMinutes: 60, price: "10", isActive: true }}
      />,
    );

    const hidden = () =>
      container.querySelector('input[name="isActive"]') as HTMLInputElement;
    expect(hidden().value).toBe("true");

    await user.click(screen.getByLabelText("סטטוס השירות"));
    expect(hidden().value).toBe("false");
  });
});

describe("ServiceForm — server state", () => {
  it("renders the form error and field errors returned from the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          formError: "משהו השתבש",
          errors: { name: SERVICES.errors.nameRequired },
          values: { name: "" },
        }) as ServiceFormState,
    );
    render(<ServiceForm action={action} />);

    await user.click(
      screen.getByRole("button", { name: new RegExp(SERVICES.form.saveButton) }),
    );

    await waitFor(() =>
      expect(screen.getByText("משהו השתבש")).toBeInTheDocument(),
    );
    expect(screen.getByText(SERVICES.errors.nameRequired)).toBeInTheDocument();
  });
});
