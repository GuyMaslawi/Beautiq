// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageTemplateCard } from "@/components/messages/message-template-card";

describe("MessageTemplateCard", () => {
  it("renders the type label, use-case, rendered preview and variable hint", () => {
    render(
      <MessageTemplateCard
        type="booking_confirmation"
        body="היי {clientName}, התור שלך ל־{serviceName} ב־{bookingDate} בשעה {bookingTime}."
      />,
    );
    // Type label
    expect(screen.getByText("אישור תור")).toBeInTheDocument();
    // Use case copy
    expect(screen.getByText("מתאים לשליחה אחרי קביעת תור")).toBeInTheDocument();
    // Real rendered preview: sample vars substituted
    expect(
      screen.getByText(/היי נועה, התור שלך ל־לק ג׳ל ב־יום שני, 12 ביוני בשעה 10:00/),
    ).toBeInTheDocument();
    // Variable hint lists the Hebrew variable labels
    expect(screen.getByText(/משתנים:/)).toHaveTextContent("שם לקוחה");
    expect(screen.getByText(/משתנים:/)).toHaveTextContent("שם השירות");
  });

  it("shows the custom badge when isCustom is true", () => {
    render(<MessageTemplateCard type="booking_reminder" body="טקסט" isCustom />);
    expect(screen.getByText("מותאם אישית")).toBeInTheDocument();
  });

  it("omits the custom badge and variable hint for a plain body", () => {
    render(<MessageTemplateCard type="booking_reminder" body="בלי משתנים בכלל" />);
    expect(screen.queryByText("מותאם אישית")).not.toBeInTheDocument();
    expect(screen.queryByText(/משתנים:/)).not.toBeInTheDocument();
    expect(screen.getByText("בלי משתנים בכלל")).toBeInTheDocument();
  });
});
