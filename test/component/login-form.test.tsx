// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// useActionState calls the action with (prevState, formData). We capture the
// formData and control the returned state via a mutable holder.
const m = vi.hoisted(() => {
  let nextState: unknown = {};
  return {
    loginAction: vi.fn(async () => m.nextState),
    setNext: (s: unknown) => {
      m.nextState = s;
    },
    get nextState() {
      return nextState;
    },
    set nextState(v: unknown) {
      nextState = v;
    },
  };
});

vi.mock("@/server/auth/actions", () => ({
  loginAction: m.loginAction,
}));

import { LoginForm } from "@/components/auth/login-form";
import { AUTH } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
  m.nextState = {};
});

describe("LoginForm", () => {
  it("renders the email and password fields and the submit button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(AUTH.login.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(AUTH.login.passwordLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: AUTH.login.submit }),
    ).toBeInTheDocument();
  });

  it("typing updates the controlled inputs and submitting calls loginAction", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const email = screen.getByLabelText(AUTH.login.emailLabel);
    const password = screen.getByLabelText(AUTH.login.passwordLabel);
    await user.type(email, "a@b.com");
    await user.type(password, "secret123");
    expect(email).toHaveValue("a@b.com");
    expect(password).toHaveValue("secret123");

    await user.click(screen.getByRole("button", { name: AUTH.login.submit }));
    await waitFor(() => expect(m.loginAction).toHaveBeenCalled());
    const fd = (m.loginAction.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.get("email")).toBe("a@b.com");
    expect(fd.get("password")).toBe("secret123");
  });

  it("renders the generic form error returned by the action and focuses email", async () => {
    m.nextState = { formError: AUTH.errors.invalidCredentials };
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: AUTH.login.submit }));
    expect(
      await screen.findByText(AUTH.errors.invalidCredentials),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(AUTH.login.emailLabel)).toHaveFocus(),
    );
  });

  it("hides the form error as soon as the user starts editing again", async () => {
    m.nextState = { formError: AUTH.errors.invalidCredentials };
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: AUTH.login.submit }));
    expect(
      await screen.findByText(AUTH.errors.invalidCredentials),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(AUTH.login.emailLabel), "x");
    expect(
      screen.queryByText(AUTH.errors.invalidCredentials),
    ).not.toBeInTheDocument();
  });
});
