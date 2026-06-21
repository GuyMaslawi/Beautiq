// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReviewsManager } from "@/components/public-page/reviews-manager";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type { ClientReviewData } from "@/server/public-page/queries";

const REVIEWS: ClientReviewData[] = [
  {
    id: "r1",
    clientName: "דנה",
    reviewText: "שירות מעולה",
    rating: 5,
    isApproved: true,
  },
  {
    id: "r2",
    clientName: "מיכל",
    reviewText: "נחמד מאוד",
    rating: 3,
    isApproved: true,
  },
];

let deleteAction: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  deleteAction = vi.fn(async () => undefined);
});

function renderManager(reviews: ClientReviewData[] = REVIEWS) {
  return render(
    <ReviewsManager
      reviews={reviews}
      deleteAction={deleteAction}
    />,
  );
}

describe("ReviewsManager", () => {
  it("always shows the info notice about public reviews", () => {
    renderManager([]);
    expect(
      screen.getByText(/ביקורות יתווספו על ידי לקוחות/),
    ).toBeInTheDocument();
  });

  it("renders the empty state when there are no reviews", () => {
    renderManager([]);
    expect(
      screen.getByText(PUBLIC_PAGE.reviews.emptyState),
    ).toBeInTheDocument();
  });

  it("renders each review with name, text and the right number of filled stars", () => {
    renderManager();
    expect(screen.getByText("דנה")).toBeInTheDocument();
    expect(screen.getByText("שירות מעולה")).toBeInTheDocument();
    expect(screen.getByText("מיכל")).toBeInTheDocument();
    expect(screen.getByText("נחמד מאוד")).toBeInTheDocument();
    expect(
      screen.queryByText(PUBLIC_PAGE.reviews.emptyState),
    ).not.toBeInTheDocument();

    // 5 stars per review × 2 reviews = 10 star svgs
    const filled = document.querySelectorAll('svg[fill="#b86b8c"]');
    expect(filled.length).toBe(8); // 5 (rating 5) + 3 (rating 3)
  });

  it("calls deleteAction with the review id when the delete button is pressed", async () => {
    renderManager();
    const delButtons = screen.getAllByTitle(PUBLIC_PAGE.reviews.deleteButton);
    await userEvent.click(delButtons[0]);
    await waitFor(() => expect(deleteAction).toHaveBeenCalledWith("r1"));
  });
});
