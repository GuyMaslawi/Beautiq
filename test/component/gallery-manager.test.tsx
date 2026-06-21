// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GalleryManager } from "@/components/public-page/gallery-manager";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type { GalleryImageData } from "@/server/public-page/queries";

const IMAGES: GalleryImageData[] = [
  { id: "g1", imageUrl: "https://x/1.jpg", caption: "עבודה 1", sortOrder: 0 },
  { id: "g2", imageUrl: "https://x/2.jpg", caption: null, sortOrder: 1 },
];

let addAction: ReturnType<typeof vi.fn>;
let deleteAction: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  addAction = vi.fn(async () => ({}));
  deleteAction = vi.fn(async () => undefined);
});

function renderManager(images: GalleryImageData[] = IMAGES) {
  return render(
    <GalleryManager
      images={images}
      addAction={addAction}
      deleteAction={deleteAction}
    />,
  );
}

describe("GalleryManager — empty & populated", () => {
  it("renders the empty state with no images", () => {
    renderManager([]);
    expect(
      screen.getByText(PUBLIC_PAGE.gallery.emptyState),
    ).toBeInTheDocument();
    // upload prompt always present
    expect(screen.getByText("לחצי להעלאת תמונות")).toBeInTheDocument();
  });

  it("renders an image grid with captions when images exist", () => {
    renderManager();
    const imgs = Array.from(document.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("alt", "עבודה 1");
    // null caption falls back to the generic alt, no "null" leak
    expect(imgs[1]).toHaveAttribute("alt", "תמונה");
    expect(screen.getByText("עבודה 1")).toBeInTheDocument();
    expect(
      screen.queryByText(PUBLIC_PAGE.gallery.emptyState),
    ).not.toBeInTheDocument();
  });

  it("falls back to a placeholder data-uri when an image fails to load", () => {
    renderManager();
    const img = document.querySelector("img") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(img.src).toContain("data:image/svg+xml");
  });
});

describe("GalleryManager — upload", () => {
  it("uploads a file then calls addAction with the returned url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://blob/new.jpg" }),
        }),
      ),
    );
    renderManager([]);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["x"], "new.jpg", { type: "image/jpeg" });
    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(addAction).toHaveBeenCalledTimes(1));
    const fd = addAction.mock.calls[0][1] as FormData;
    expect(fd.get("imageUrl")).toBe("https://blob/new.jpg");
  });

  it("uploads via drag-and-drop onto the upload zone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://blob/drop.jpg" }),
        }),
      ),
    );
    renderManager([]);
    const zone = screen.getByText("לחצי להעלאת תמונות").closest("div")!
      .parentElement!;
    const file = new File(["x"], "drop.jpg", { type: "image/jpeg" });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(addAction).toHaveBeenCalledTimes(1));
  });

  it("surfaces an upload error and stops without calling addAction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "העלאה נכשלה" }),
        }),
      ),
    );
    renderManager([]);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["x"], "bad.jpg", { type: "image/jpeg" });
    await userEvent.upload(fileInput, file);

    await waitFor(() =>
      expect(screen.getByText("העלאה נכשלה")).toBeInTheDocument(),
    );
    expect(addAction).not.toHaveBeenCalled();
  });
});

describe("GalleryManager — delete", () => {
  it("calls deleteAction with the image id when the delete button is pressed", async () => {
    renderManager();
    const delButtons = screen.getAllByTitle(PUBLIC_PAGE.gallery.deleteButton);
    await userEvent.click(delButtons[0]);
    await waitFor(() => expect(deleteAction).toHaveBeenCalledWith("g1"));
  });
});
