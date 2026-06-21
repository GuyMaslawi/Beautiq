// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "@/components/ui/field";

describe("Field", () => {
  it("renders label bound to the input via htmlFor", () => {
    render(
      <Field label="שם הלקוחה" htmlFor="name">
        <input id="name" />
      </Field>,
    );
    const label = screen.getByText("שם הלקוחה");
    expect(label).toHaveAttribute("for", "name");
    expect(screen.getByLabelText("שם הלקוחה")).toBeInTheDocument();
  });

  it("renders hint when there is no error", () => {
    render(
      <Field label="טלפון" htmlFor="phone" hint="מספר נייד">
        <input id="phone" />
      </Field>,
    );
    expect(screen.getByText("מספר נייד")).toBeInTheDocument();
  });

  it("renders error and hides hint when error is present", () => {
    render(
      <Field label="טלפון" htmlFor="phone" hint="מספר נייד" error="שדה חובה">
        <input id="phone" />
      </Field>,
    );
    expect(screen.getByText("שדה חובה")).toBeInTheDocument();
    expect(screen.queryByText("מספר נייד")).not.toBeInTheDocument();
  });
});
