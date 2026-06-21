// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

import { BrandingForm } from "@/components/public-page/branding-form";
import { PUBLIC_PAGE } from "@/lib/constants/he";

const action = vi.fn(async () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
  h.state = {};
  h.isPending = false;
});

function renderForm(
  initialValues = {
    logoUrl: null as string | null,
    coverImageUrl: null as string | null,
    brandColor: null as string | null,
  },
) {
  return render(
    <BrandingForm action={action} initialValues={initialValues} />,
  );
}

describe("BrandingForm — rendering", () => {
  it("renders both upload zones, the colour controls and default brand colour", () => {
    renderForm();
    expect(screen.getByText(PUBLIC_PAGE.branding.logoLabel)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.branding.coverLabel)).toBeInTheDocument();
    expect(screen.getByText("צבע מותג")).toBeInTheDocument();
    // two empty drop zones with the upload prompt
    expect(screen.getAllByText("לחצי להעלאת תמונה")).toHaveLength(2);

    const color = document.getElementById("brandColor") as HTMLInputElement;
    expect(color.value).toBe("#b86b8c");
  });

  it("shows existing images (with remove/replace) when initial urls are provided", () => {
    renderForm({
      logoUrl: "https://x/logo.png",
      coverImageUrl: "https://x/cover.png",
      brandColor: "#123456",
    });
    const imgs = Array.from(document.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    expect((document.getElementById("brandColor") as HTMLInputElement).value).toBe(
      "#123456",
    );
    expect(screen.getAllByText("החלפה").length).toBe(2);
  });
});

describe("BrandingForm — brand colour controls", () => {
  it("edits the colour via the text input and resets to default", async () => {
    renderForm();
    const text = document.querySelector(
      'input[type="text"][maxLength="7"]',
    ) as HTMLInputElement;
    await userEvent.clear(text);
    await userEvent.type(text, "#000000");
    expect(text.value).toBe("#000000");
    const hidden = document.getElementById("brandColor") as HTMLInputElement;
    expect(hidden.value).toBe("#000000");

    await userEvent.click(screen.getByText("ברירת מחדל"));
    expect((document.getElementById("brandColor") as HTMLInputElement).value).toBe(
      "#b86b8c",
    );
  });
});

describe("BrandingForm — colour picker & remove", () => {
  it("updates the colour via the native colour input", async () => {
    renderForm();
    const color = document.getElementById("brandColor") as HTMLInputElement;
    color.value = "#abcdef";
    color.dispatchEvent(new Event("input", { bubbles: true }));
    expect(
      (document.getElementById("brandColor") as HTMLInputElement).value,
    ).toBe("#abcdef");
  });

  it("removes an existing cover image when its remove button is pressed", async () => {
    renderForm({
      logoUrl: "https://x/logo.png",
      coverImageUrl: "https://x/cover.png",
      brandColor: "#b86b8c",
    });
    expect(document.querySelectorAll("img")).toHaveLength(2);
    // each preview has a remove (X) button titled "הסרת תמונה"
    const removeButtons = screen.getAllByTitle("הסרת תמונה");
    await userEvent.click(removeButtons[1]);
    // cover removed → its hidden input is empty again
    const hidden = document.querySelector(
      'input[name="coverImageUrl"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");
  });
});

describe("BrandingForm — image upload", () => {
  it("uploads via drag-and-drop onto the logo zone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://blob/dropped.png" }),
        }),
      ),
    );
    renderForm();
    const zone = screen.getAllByText("לחצי להעלאת תמונה")[0].closest("div")!
      .parentElement!;
    const file = new File(["x"], "drop.png", { type: "image/png" });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      const hidden = document.querySelector(
        'input[name="logoUrl"]',
      ) as HTMLInputElement;
      expect(hidden.value).toBe("https://blob/dropped.png");
    });
  });

  it("uploads a logo and stores the returned url in the hidden input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://blob/logo.png" }),
        }),
      ),
    );
    renderForm();
    const fileInput = document.getElementById("logo-upload") as HTMLInputElement;
    const file = new File(["x"], "logo.png", { type: "image/png" });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      const hidden = document.querySelector(
        'input[name="logoUrl"]',
      ) as HTMLInputElement;
      expect(hidden.value).toBe("https://blob/logo.png");
    });
  });

  it("shows an upload error when the upload endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "קובץ גדול מדי" }),
        }),
      ),
    );
    renderForm();
    const fileInput = document.getElementById("cover-upload") as HTMLInputElement;
    const file = new File(["x"], "cover.png", { type: "image/png" });
    await userEvent.upload(fileInput, file);

    await waitFor(() =>
      expect(screen.getByText("קובץ גדול מדי")).toBeInTheDocument(),
    );
  });
});

describe("BrandingForm — action state", () => {
  it("renders the brand-color field error", () => {
    h.state = { errors: { brandColor: "צבע לא תקין" } };
    renderForm();
    expect(screen.getByText("צבע לא תקין")).toBeInTheDocument();
  });

  it("renders the form error and the success message", () => {
    h.state = { formError: "שמירה נכשלה", success: PUBLIC_PAGE.branding.success };
    renderForm();
    expect(screen.getByText("שמירה נכשלה")).toBeInTheDocument();
    expect(
      screen.getByText(PUBLIC_PAGE.branding.success),
    ).toBeInTheDocument();
  });

  it("disables the submit and shows the saving label while pending", () => {
    h.isPending = true;
    renderForm();
    expect(
      screen.getByRole("button", { name: PUBLIC_PAGE.branding.saving }),
    ).toBeDisabled();
  });
});
