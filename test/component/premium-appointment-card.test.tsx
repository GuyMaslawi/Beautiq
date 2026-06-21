// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppointmentTimelineCard } from "@/components/premium/appointment-card";

describe("AppointmentTimelineCard", () => {
  it("renders time, client, initials and a plain name (no href)", () => {
    render(
      <AppointmentTimelineCard time="14:30" clientName="נועה" initials="נ" />,
    );
    expect(screen.getByText("14:30")).toBeInTheDocument();
    expect(screen.getByText("נ")).toBeInTheDocument();
    expect(screen.getByText("נועה")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders endTime, serviceName, meta, status, price and link", () => {
    render(
      <AppointmentTimelineCard
        time="14:30"
        endTime="15:15"
        clientName="דנה"
        initials="ד"
        serviceName="מניקור"
        meta={<span>הערה</span>}
        statusTone="success"
        statusLabel="מאושר"
        price="₪180"
        href="/clients/1"
      />,
    );
    expect(screen.getByText("15:15")).toBeInTheDocument();
    expect(screen.getByText("מניקור")).toBeInTheDocument();
    expect(screen.getByText("הערה")).toBeInTheDocument();
    expect(screen.getByText("מאושר")).toBeInTheDocument();
    expect(screen.getByText("₪180")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "דנה" })).toHaveAttribute(
      "href",
      "/clients/1",
    );
  });

  it("renders actions and supports dim + rail=false", () => {
    const { container } = render(
      <AppointmentTimelineCard
        time="10:00"
        clientName="x"
        initials="x"
        rail={false}
        dim
        actions={<button>אישור</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "אישור" })).toBeInTheDocument();
    expect(container.querySelector(".opacity-65")).toBeInTheDocument();
  });
});
