// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
} from "@/components/ui/tabs";

function Example({ variant }: { variant?: "default" | "line" }) {
  return (
    <Tabs defaultValue="a">
      <TabsList variant={variant}>
        <TabsTrigger value="a">לשונית א</TabsTrigger>
        <TabsTrigger value="b">לשונית ב</TabsTrigger>
      </TabsList>
      <TabsContent value="a">תוכן א</TabsContent>
      <TabsContent value="b">תוכן ב</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("shows the default tab content and switches on click", async () => {
    render(<Example />);
    expect(screen.getByText("תוכן א")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "לשונית ב" }));
    expect(screen.getByText("תוכן ב")).toBeInTheDocument();
  });

  it("renders the line variant list", () => {
    render(<Example variant="line" />);
    expect(
      document.querySelector('[data-slot="tabs-list"]'),
    ).toHaveAttribute("data-variant", "line");
  });

  it("supports vertical orientation", () => {
    render(
      <Tabs defaultValue="a" orientation="vertical">
        <TabsList>
          <TabsTrigger value="a">a</TabsTrigger>
        </TabsList>
        <TabsContent value="a">c</TabsContent>
      </Tabs>,
    );
    expect(document.querySelector('[data-slot="tabs"]')).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("tabsListVariants returns a class string", () => {
    expect(typeof tabsListVariants({ variant: "line" })).toBe("string");
  });
});
