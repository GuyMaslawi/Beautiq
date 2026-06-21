// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => {
  let nextState: unknown = {};
  return {
    signupAction: vi.fn(async () => m.nextState),
    get nextState() {
      return nextState;
    },
    set nextState(v: unknown) {
      nextState = v;
    },
  };
});

vi.mock("@/server/auth/actions", () => ({
  signupAction: m.signupAction,
}));

import { SignupForm } from "@/components/auth/signup-form";
import { AUTH } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
  m.nextState = {};
});

describe("SignupForm", () => {
  it("renders all four fields and the submit button", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(AUTH.signup.nameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(AUTH.signup.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(AUTH.signup.passwordLabel)).toBeInTheDocument();
    expect(
      screen.getByLabelText(AUTH.signup.confirmPasswordLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: AUTH.signup.submit }),
    ).toBeInTheDocument();
  });

  it("submits all entered values to signupAction", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(AUTH.signup.nameLabel), "נועה");
    await user.type(screen.getByLabelText(AUTH.signup.emailLabel), "a@b.com");
    await user.type(screen.getByLabelText(AUTH.signup.passwordLabel), "password1");
    await user.type(
      screen.getByLabelText(AUTH.signup.confirmPasswordLabel),
      "password1",
    );
    await user.click(screen.getByRole("button", { name: AUTH.signup.submit }));

    await waitFor(() => expect(m.signupAction).toHaveBeenCalled());
    const fd = (m.signupAction.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.get("name")).toBe("נועה");
    expect(fd.get("email")).toBe("a@b.com");
    expect(fd.get("password")).toBe("password1");
    expect(fd.get("confirmPassword")).toBe("password1");
  });

  it("renders per-field errors and focuses the first invalid field", async () => {
    m.nextState = {
      errors: {
        email: AUTH.errors.invalidEmail,
        password: AUTH.errors.passwordTooShort,
      },
    };
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: AUTH.signup.submit }));
    expect(await screen.findByText(AUTH.errors.invalidEmail)).toBeInTheDocument();
    expect(screen.getByText(AUTH.errors.passwordTooShort)).toBeInTheDocument();
    // email is the first invalid field in FIELDS order -> it gets focus.
    await waitFor(() =>
      expect(screen.getByLabelText(AUTH.signup.emailLabel)).toHaveFocus(),
    );
  });

  it("clears only the edited field's error when the user fixes it", async () => {
    m.nextState = {
      errors: {
        email: AUTH.errors.invalidEmail,
        password: AUTH.errors.passwordTooShort,
      },
    };
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: AUTH.signup.submit }));
    expect(await screen.findByText(AUTH.errors.invalidEmail)).toBeInTheDocument();

    await user.type(screen.getByLabelText(AUTH.signup.emailLabel), "x");
    expect(screen.queryByText(AUTH.errors.invalidEmail)).not.toBeInTheDocument();
    // The untouched password error remains.
    expect(screen.getByText(AUTH.errors.passwordTooShort)).toBeInTheDocument();
  });

  it("renders a general form error and clears it after any edit", async () => {
    m.nextState = { formError: AUTH.errors.generic };
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: AUTH.signup.submit }));
    expect(await screen.findByText(AUTH.errors.generic)).toBeInTheDocument();

    await user.type(screen.getByLabelText(AUTH.signup.nameLabel), "x");
    expect(screen.queryByText(AUTH.errors.generic)).not.toBeInTheDocument();
  });
});
