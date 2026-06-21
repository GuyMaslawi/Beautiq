// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ importClients: vi.fn() }));
vi.mock("@/server/clients/import", () => ({ importClients: m.importClients }));

import { ImportWizard } from "@/components/clients/import-wizard";
import { CLIENT_IMPORT } from "@/lib/constants/he";

const U = CLIENT_IMPORT.upload;
const MAP = CLIENT_IMPORT.mapping;
const PREV = CLIENT_IMPORT.preview;
const RES = CLIENT_IMPORT.result;

/** Build a File whose FileReader.readAsText resolves to the given CSV text. */
function csvFile(text: string, name = "clients.csv"): File {
  return new File([text], name, { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.importClients.mockResolvedValue({ created: 0, duplicates: 0, failed: 0 });
});

describe("ImportWizard — upload step", () => {
  it("renders the stepper and both upload methods, defaulting to file", () => {
    render(<ImportWizard />);
    expect(screen.getByText(U.methodFile)).toBeInTheDocument();
    expect(screen.getByText(U.methodPaste)).toBeInTheDocument();
    // File dropzone visible by default.
    expect(screen.getByText(U.fileBrowse)).toBeInTheDocument();
    // Stepper labels.
    expect(screen.getByText(CLIENT_IMPORT.steps.upload)).toBeInTheDocument();
  });

  it("shows an error when continuing with no file selected", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />);
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    expect(await screen.findByText(U.emptyError)).toBeInTheDocument();
  });

  it("switches to the paste method and shows the textarea", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));
    expect(screen.getByText(U.pasteLabel)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows an error when continuing with empty pasted text", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    expect(await screen.findByText(U.emptyError)).toBeInTheDocument();
  });
});

describe("ImportWizard — paste flow goes straight to preview", () => {
  it("parses comma-separated rows and shows valid/invalid/duplicate statuses", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));

    const textarea = screen.getByRole("textbox");
    // valid, valid-dup (same phone), invalid phone, missing name
    await user.type(
      textarea,
      "נועה כהן, 0501111111{enter}מיה לוי, 0501111111{enter}דנה, 123{enter}, 0502222222",
    );
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));

    // Now on preview step — summary chips reflect 1 valid, 1 duplicate, 2 invalid.
    expect(await screen.findByText(PREV.summaryValid(1))).toBeInTheDocument();
    expect(screen.getByText(PREV.summaryDuplicate(1))).toBeInTheDocument();
    expect(screen.getByText(PREV.summaryInvalid(2))).toBeInTheDocument();

    // Status labels appear in the table.
    expect(screen.getAllByText(PREV.status.valid).length).toBeGreaterThan(0);
    expect(screen.getByText(PREV.status.in_file_duplicate)).toBeInTheDocument();
    expect(screen.getByText(PREV.status.invalid_phone)).toBeInTheDocument();
    expect(screen.getByText(PREV.status.no_name)).toBeInTheDocument();
  });

  it("parses tab-separated rows", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));
    const textarea = screen.getByRole("textbox");
    // userEvent can't type a literal tab easily; set value via paste.
    await user.click(textarea);
    await user.paste("נועה כהן\t0501111111");
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    expect(await screen.findByText(PREV.summaryValid(1))).toBeInTheDocument();
  });

  it("parses space-separated 'name phone' rows", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));
    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.paste("נועה כהן 0501111111");
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    expect(await screen.findByText(PREV.summaryValid(1))).toBeInTheDocument();
  });
});

describe("ImportWizard — preview actions", () => {
  async function gotoPreviewWithOneValid(user: ReturnType<typeof userEvent.setup>) {
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));
    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.paste("נועה כהן, 0501111111");
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    await screen.findByText(PREV.summaryValid(1));
  }

  it("imports the valid rows and shows the result step with created count", async () => {
    m.importClients.mockResolvedValue({ created: 1, duplicates: 0, failed: 0 });
    const user = userEvent.setup();
    await gotoPreviewWithOneValid(user);

    await user.click(screen.getByRole("button", { name: PREV.importButton(1) }));
    await waitFor(() => expect(m.importClients).toHaveBeenCalled());

    // Verify payload shape: array of clients + opt-in boolean.
    const [rows, optIn] = m.importClients.mock.calls[0];
    expect(rows).toEqual([{ fullName: "נועה כהן", phone: "0501111111" }]);
    expect(optIn).toBe(false);

    expect(await screen.findByText(RES.title)).toBeInTheDocument();
    expect(screen.getByText(RES.created(1))).toBeInTheDocument();
  });

  it("passes whatsappOptIn=true when the checkbox is ticked", async () => {
    m.importClients.mockResolvedValue({ created: 1, duplicates: 0, failed: 0 });
    const user = userEvent.setup();
    await gotoPreviewWithOneValid(user);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: PREV.importButton(1) }));
    await waitFor(() => expect(m.importClients).toHaveBeenCalled());
    expect(m.importClients.mock.calls[0][1]).toBe(true);
  });

  it("disables the import button when there are no valid rows and shows the empty notice", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));
    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.paste("דנה, 123"); // invalid phone only
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));

    expect(await screen.findByText(PREV.noValidRows)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: PREV.importButton(0) })).toBeDisabled();
  });

  it("can go back from preview to upload (paste has no mapping step)", async () => {
    const user = userEvent.setup();
    await gotoPreviewWithOneValid(user);
    await user.click(screen.getByRole("button", { name: PREV.backButton }));
    // Back on the upload step.
    expect(await screen.findByText(U.methodFile)).toBeInTheDocument();
  });

  it("shows the result with duplicates and failed counts", async () => {
    m.importClients.mockResolvedValue({ created: 2, duplicates: 1, failed: 3 });
    const user = userEvent.setup();
    await gotoPreviewWithOneValid(user);
    await user.click(screen.getByRole("button", { name: PREV.importButton(1) }));

    expect(await screen.findByText(RES.created(2))).toBeInTheDocument();
    expect(screen.getByText(RES.duplicates(1))).toBeInTheDocument();
    expect(screen.getByText(RES.failed(3))).toBeInTheDocument();
  });
});

describe("ImportWizard — result step CTAs", () => {
  async function gotoResult(user: ReturnType<typeof userEvent.setup>) {
    m.importClients.mockResolvedValue({ created: 1, duplicates: 0, failed: 0 });
    render(<ImportWizard />);
    await user.click(screen.getByText(U.methodPaste));
    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.paste("נועה כהן, 0501111111");
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    await screen.findByText(PREV.summaryValid(1));
    await user.click(screen.getByRole("button", { name: PREV.importButton(1) }));
    await screen.findByText(RES.title);
  }

  it("renders the view-clients and bring-back links", async () => {
    const user = userEvent.setup();
    await gotoResult(user);
    expect(screen.getByText(RES.ctaViewClients).closest("a")).toHaveAttribute("href", "/clients");
    expect(screen.getByText(RES.ctaBringBack).closest("a")).toHaveAttribute("href", "/bring-back");
    expect(screen.getByText(RES.bringBackNote)).toBeInTheDocument();
  });

  it("resets to the upload step via 'import more'", async () => {
    const user = userEvent.setup();
    await gotoResult(user);
    await user.click(screen.getByRole("button", { name: RES.ctaImportMore }));
    expect(await screen.findByText(U.methodFile)).toBeInTheDocument();
    // Stepper back to start.
    expect(screen.getByText(CLIENT_IMPORT.steps.upload)).toBeInTheDocument();
  });
});

describe("ImportWizard — CSV file flow with mapping step", () => {
  it("auto-detects columns, shows preview-of-file, then advances to the data preview", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImportWizard />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(
      input,
      csvFile("שם,טלפון,אימייל\nנועה כהן,0501111111,noa@x.com\nמיה לוי,0502222222,"),
    );

    // File name confirmation appears.
    await waitFor(() =>
      expect(screen.getByText(U.fileSelected("clients.csv"))).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));

    // Mapping step.
    expect(await screen.findByRole("heading", { name: MAP.title })).toBeInTheDocument();
    expect(screen.getByText(MAP.previewTitle)).toBeInTheDocument();
    // Auto-detected: name select pre-set to "שם".
    const nameSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(nameSelect.value).toBe("שם");

    // Continue to preview.
    await user.click(screen.getByRole("button", { name: new RegExp(MAP.nextButton) }));
    expect(await screen.findByText(PREV.summaryValid(2))).toBeInTheDocument();
  });

  it("shows the empty-file error for a file with no headers", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImportWizard />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, csvFile("\n\n"));
    // Inline parse error from the reader.
    expect(await screen.findByText(/הקובץ ריק/)).toBeInTheDocument();
  });

  it("requires name and phone mapping before continuing", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImportWizard />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // Headers that do NOT auto-map to name/phone.
    await user.upload(input, csvFile("colA,colB\nfoo,bar"));
    await waitFor(() => expect(screen.getByText(U.fileSelected("clients.csv"))).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));

    await screen.findByRole("heading", { name: MAP.title });
    await user.click(screen.getByRole("button", { name: new RegExp(MAP.nextButton) }));
    // Validation errors shown, still on mapping.
    expect(await screen.findByText(MAP.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(MAP.phoneRequired)).toBeInTheDocument();
  });

  it("lets the user manually map columns then proceed", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImportWizard />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, csvFile("colA,colB\nנועה כהן,0501111111"));
    await waitFor(() => expect(screen.getByText(U.fileSelected("clients.csv"))).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    await screen.findByRole("heading", { name: MAP.title });

    const selects = screen.getAllByRole("combobox");
    // Map name -> colA, phone -> colB.
    await user.selectOptions(selects[0], "colA");
    await user.selectOptions(selects[1], "colB");
    await user.click(screen.getByRole("button", { name: new RegExp(MAP.nextButton) }));

    expect(await screen.findByText(PREV.summaryValid(1))).toBeInTheDocument();
  });

  it("goes back from mapping to upload", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImportWizard />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, csvFile("שם,טלפון\nנועה,0501111111"));
    await waitFor(() => expect(screen.getByText(U.fileSelected("clients.csv"))).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    await screen.findByRole("heading", { name: MAP.title });

    await user.click(screen.getByRole("button", { name: MAP.backButton }));
    expect(await screen.findByText(U.methodFile)).toBeInTheDocument();
  });

  it("goes back from preview to mapping for a CSV flow", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImportWizard />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, csvFile("שם,טלפון\nנועה,0501111111"));
    await waitFor(() => expect(screen.getByText(U.fileSelected("clients.csv"))).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    await screen.findByRole("heading", { name: MAP.title });
    await user.click(screen.getByRole("button", { name: new RegExp(MAP.nextButton) }));
    await screen.findByText(PREV.summaryValid(1));

    await user.click(screen.getByRole("button", { name: PREV.backButton }));
    // Back on mapping (CSV flow has csvHeaders).
    expect(await screen.findByRole("heading", { name: MAP.title })).toBeInTheDocument();
  });

  it("detects a semicolon delimiter", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImportWizard />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, csvFile("שם;טלפון\nנועה כהן;0501111111"));
    await waitFor(() => expect(screen.getByText(U.fileSelected("clients.csv"))).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: new RegExp(U.nextButton) }));
    await screen.findByRole("heading", { name: MAP.title });
    await user.click(screen.getByRole("button", { name: new RegExp(MAP.nextButton) }));
    expect(await screen.findByText(PREV.summaryValid(1))).toBeInTheDocument();
  });
});
