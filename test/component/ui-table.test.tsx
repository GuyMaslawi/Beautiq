// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

describe("Table", () => {
  it("renders a full table composition", () => {
    render(
      <Table className="t-x">
        <TableCaption>רשימת לקוחות</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>שם</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state="selected">
            <TableCell>נועה</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>סה״כ</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    expect(screen.getByRole("table")).toHaveClass("t-x");
    expect(screen.getByText("רשימת לקוחות")).toBeInTheDocument();
    expect(screen.getByText("שם")).toBeInTheDocument();
    expect(screen.getByText("נועה")).toBeInTheDocument();
    expect(screen.getByText("סה״כ")).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="table-container"]'),
    ).toBeInTheDocument();
  });

  it("each part exposes its data-slot", () => {
    render(
      <Table>
        <TableHeader className="h" />
        <TableBody className="b" />
      </Table>,
    );
    expect(document.querySelector('[data-slot="table-header"]')).toHaveClass(
      "h",
    );
    expect(document.querySelector('[data-slot="table-body"]')).toHaveClass("b");
  });
});
