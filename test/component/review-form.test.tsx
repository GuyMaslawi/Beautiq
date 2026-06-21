// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// useActionState drives this form; we mock the server action so the bound
// action is a no-op. The action's state is supplied per-render via a controllable
// mock of React's useActionState would be heavy — instead we drive real
// useActionState with a stub action and assert structure/interaction.
const { reviewAction } = vi.hoisted(() => ({
  reviewAction: {
    bind: vi.fn(() =>
      vi.fn<(p: unknown, fd: FormData) => Promise<Record<string, unknown>>>(async () => ({})),
    ),
  },
}));
vi.mock("@/server/public-booking/actions", () => ({
  submitPublicReviewAction: reviewAction,
}));

import { PublicReviewForm } from "@/app/b/[slug]/review-form";

beforeEach(() => {
  vi.clearAllMocks();
  reviewAction.bind.mockReturnValue(
    vi.fn<(p: unknown, fd: FormData) => Promise<Record<string, unknown>>>(async () => ({})),
  );
});

function renderForm() {
  return render(<PublicReviewForm slug="studio-yofi" brandColor="#b86b8c" />);
}

describe("PublicReviewForm", () => {
  it("binds the server action to the slug", () => {
    renderForm();
    expect(reviewAction.bind).toHaveBeenCalledWith(null, "studio-yofi");
  });

  it("renders the Hebrew name/rating/review fields and submit button", () => {
    renderForm();
    expect(screen.getByLabelText("שמך")).toBeInTheDocument();
    expect(screen.getByText("דירוג")).toBeInTheDocument();
    expect(screen.getByLabelText("הביקורת שלך")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "שליחת ביקורת" })).toBeInTheDocument();
  });

  it("defaults the hidden rating input to 5 and updates it via the star picker", async () => {
    const { container } = renderForm();
    const hidden = container.querySelector(
      'input[name="rating"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("5");

    // 5 star buttons; click the 3rd to set rating=3.
    const stars = screen.getAllByRole("button").filter((b) => b.getAttribute("type") === "button");
    expect(stars).toHaveLength(5);
    await userEvent.click(stars[2]);
    expect(hidden.value).toBe("3");
  });

  it("exposes the form field names the server action consumes", () => {
    const { container } = renderForm();
    expect(container.querySelector('input[name="clientName"]')).toBeInTheDocument();
    expect(container.querySelector('textarea[name="reviewText"]')).toBeInTheDocument();
  });

  it("does not leak placeholder garbage into the DOM", () => {
    const { container } = renderForm();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/undefined|null|NaN|lorem/i);
  });
});

describe("PublicReviewForm — success state", () => {
  it("renders the thank-you panel once the action returns success", async () => {
    // Bind returns an action that resolves to a success state, then submit.
    reviewAction.bind.mockReturnValue(vi.fn(async () => ({ success: true })));
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "שליחת ביקורת" }));
    expect(await screen.findByText("תודה רבה על הביקורת!")).toBeInTheDocument();
    expect(screen.getByText("הביקורת שלך התקבלה בהצלחה.")).toBeInTheDocument();
  });
});

describe("PublicReviewForm — error states", () => {
  it("shows a top-level form error and per-field errors", async () => {
    reviewAction.bind.mockReturnValue(
      vi.fn(async () => ({
        formError: "אירעה שגיאה",
        errors: { clientName: "נא להזין שם", reviewText: "נא לכתוב ביקורת" },
      })),
    );
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "שליחת ביקורת" }));
    expect(await screen.findByText("אירעה שגיאה")).toBeInTheDocument();
    expect(screen.getByText("נא להזין שם")).toBeInTheDocument();
    expect(screen.getByText("נא לכתוב ביקורת")).toBeInTheDocument();
  });
});
