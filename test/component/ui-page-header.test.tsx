// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

describe("PageHeader", () => {
  it("renders title, subtitle and icon", () => {
    render(
      <PageHeader icon={Sparkles} title="שירותים ומחירים" subtitle="נהל את השירותים" />,
    );
    expect(
      screen.getByRole("heading", { name: "שירותים ומחירים" }),
    ).toBeInTheDocument();
    expect(screen.getByText("נהל את השירותים")).toBeInTheDocument();
  });

  it("renders the optional action slot", () => {
    render(
      <PageHeader
        icon={Sparkles}
        title="t"
        subtitle="s"
        action={<button>תור חדש</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "תור חדש" })).toBeInTheDocument();
  });

  it("omits the action slot when not provided", () => {
    render(<PageHeader icon={Sparkles} title="t" subtitle="s" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
