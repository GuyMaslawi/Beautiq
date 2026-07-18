"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  Users,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { importClients } from "@/server/clients/import";
import { isValidIsraeliPhone, normalizePhone } from "@/lib/phone";
import { CLIENT_IMPORT } from "@/lib/constants/he";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "upload" | "mapping" | "preview" | "result";
type UploadMethod = "file" | "paste";
type RowStatus =
  | "valid"
  | "no_name"
  | "no_phone"
  | "invalid_phone"
  | "in_file_duplicate";

interface PreviewRow {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  status: RowStatus;
}

interface ColumnMap {
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface ImportResult {
  created: number;
  duplicates: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// CSV / paste parsing utilities
// ---------------------------------------------------------------------------

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === delimiter && !inQuote) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function parseCSV(
  text: string,
): { headers: string[]; rows: Record<string, string>[] } {
  const clean = stripBom(text);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delimiter);

  const rows = lines.slice(1).map((line) => {
    const values = splitCSVLine(line, delimiter);
    return headers.reduce(
      (acc, h, i) => {
        acc[h] = values[i] ?? "";
        return acc;
      },
      {} as Record<string, string>,
    );
  });

  return { headers, rows };
}

// Auto-detect column name from known candidates (case-insensitive)
const NAME_CANDIDATES = [
  "שם",
  "שם מלא",
  "שם לקוחה",
  "שם לקוח",
  "לקוחה",
  "לקוח",
  "name",
  "full name",
  "fullname",
  "customer",
  "client",
];
const PHONE_CANDIDATES = [
  "טלפון",
  "נייד",
  "מספר טלפון",
  "מספר",
  "phone",
  "mobile",
  "tel",
  "telephone",
  "cell",
];
const EMAIL_CANDIDATES = ["אימייל", "מייל", "email", "e-mail", "mail"];
const NOTES_CANDIDATES = [
  "הערות",
  "הערה",
  "notes",
  "note",
  "comment",
  "comments",
];

function detectColumn(
  headers: string[],
  candidates: string[],
): string | null {
  for (const h of headers) {
    if (candidates.some((c) => c.toLowerCase() === h.toLowerCase().trim())) {
      return h;
    }
  }
  return null;
}

function autoDetectColumnMap(headers: string[]): ColumnMap {
  return {
    name: detectColumn(headers, NAME_CANDIDATES),
    phone: detectColumn(headers, PHONE_CANDIDATES),
    email: detectColumn(headers, EMAIL_CANDIDATES),
    notes: detectColumn(headers, NOTES_CANDIDATES),
  };
}

// Parse pasted text — one client per line, name+phone (comma or tab or space)
function parsePasteText(text: string): PreviewRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const seenPhones = new Set<string>();

  return lines.map((line) => {
    // Try comma first, then tab, then last-resort split on two+ spaces
    let parts: string[];
    if (line.includes(",")) {
      parts = line.split(",").map((p) => p.trim());
    } else if (line.includes("\t")) {
      parts = line.split("\t").map((p) => p.trim());
    } else {
      // Split on first sequence of 2+ spaces or a single space if phone detected
      const spaceIdx = line.search(/\s{2,}|\s(?=0\d|05|\+972)/);
      if (spaceIdx !== -1) {
        parts = [line.slice(0, spaceIdx).trim(), line.slice(spaceIdx).trim()];
      } else {
        // Try splitting on last space
        const lastSpace = line.lastIndexOf(" ");
        parts =
          lastSpace !== -1
            ? [line.slice(0, lastSpace).trim(), line.slice(lastSpace).trim()]
            : [line.trim(), ""];
      }
    }

    const fullName = parts[0] ?? "";
    const phone = parts[1] ?? "";
    const email = parts[2] ?? "";
    const notes = parts[3] ?? "";

    const status = getRowStatus(fullName, phone, seenPhones);
    if (status === "valid") seenPhones.add(normalizePhone(phone));

    return { fullName, phone, email, notes, status };
  });
}

function getRowStatus(
  fullName: string,
  phone: string,
  seenPhones: Set<string>,
): RowStatus {
  if (!fullName.trim()) return "no_name";
  if (!phone.trim()) return "no_phone";
  if (!isValidIsraeliPhone(phone)) return "invalid_phone";
  if (seenPhones.has(normalizePhone(phone))) return "in_file_duplicate";
  return "valid";
}

function buildPreviewFromCSV(
  rows: Record<string, string>[],
  columnMap: ColumnMap,
): PreviewRow[] {
  const seenPhones = new Set<string>();

  return rows.map((row) => {
    const fullName = columnMap.name ? (row[columnMap.name] ?? "") : "";
    const phone = columnMap.phone ? (row[columnMap.phone] ?? "") : "";
    const email = columnMap.email ? (row[columnMap.email] ?? "") : "";
    const notes = columnMap.notes ? (row[columnMap.notes] ?? "") : "";

    const status = getRowStatus(fullName, phone, seenPhones);
    if (status === "valid") seenPhones.add(normalizePhone(phone));

    return { fullName, phone, email, notes, status };
  });
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: CLIENT_IMPORT.steps.upload },
  { key: "mapping", label: CLIENT_IMPORT.steps.mapping },
  { key: "preview", label: CLIENT_IMPORT.steps.preview },
  { key: "result", label: CLIENT_IMPORT.steps.import },
];

function Stepper({ current }: { current: Step }) {
  const stepKeys: Step[] = ["upload", "mapping", "preview", "result"];
  const currentIdx = stepKeys.indexOf(current);

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
              style={{
                background: done
                  ? "rgba(172,92,127,0.15)"
                  : active
                    ? "linear-gradient(135deg,#c76f93 0%,#ac5c7f 100%)"
                    : "var(--border)",
                color: done ? "#ac5c7f" : active ? "#fff" : "var(--muted)",
                boxShadow: active
                  ? "0 2px 8px rgba(172,92,127,0.30)"
                  : "none",
              }}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className="hidden text-center text-[10px] font-medium sm:block"
              style={{ color: active ? "#ac5c7f" : "var(--muted)" }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: RowStatus }) {
  const label = CLIENT_IMPORT.preview.status[status];

  if (status === "valid") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          background: "rgba(34,197,94,0.10)",
          color: "#166534",
          border: "1px solid rgba(34,197,94,0.20)",
        }}
      >
        <CheckCircle2 className="h-3 w-3" />
        {label}
      </span>
    );
  }

  if (status === "in_file_duplicate") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          background: "rgba(184,150,10,0.10)",
          color: "#7a6400",
          border: "1px solid rgba(184,150,10,0.20)",
        }}
      >
        <Info className="h-3 w-3" />
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: "rgba(239,68,68,0.10)",
        color: "#991b1b",
        border: "1px solid rgba(239,68,68,0.20)",
      }}
    >
      <XCircle className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------------------

function StepUpload({
  onNext,
}: {
  onNext: (
    method: UploadMethod,
    csvHeaders: string[],
    csvRows: Record<string, string>[],
    pasteRows: PreviewRow[],
  ) => void;
}) {
  const [method, setMethod] = useState<UploadMethod>("file");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setProcessing(true);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        try {
          const parsed = parseCSV(text);
          if (parsed.headers.length === 0) {
            setError("הקובץ ריק או שאינו בפורמט CSV תקין.");
            setProcessing(false);
            return;
          }
          setCsvData(parsed);
        } catch {
          setError("לא ניתן לקרוא את הקובץ. ודאי שמדובר ב-CSV תקין.");
        }
        setProcessing(false);
      };
      reader.readAsText(file, "UTF-8");
    },
    [],
  );

  const handleNext = () => {
    setError(null);

    if (method === "file") {
      if (!csvData) {
        setError(CLIENT_IMPORT.upload.emptyError);
        return;
      }
      onNext("file", csvData.headers, csvData.rows, []);
    } else {
      if (!pasteText.trim()) {
        setError(CLIENT_IMPORT.upload.emptyError);
        return;
      }
      const rows = parsePasteText(pasteText);
      onNext("paste", [], [], rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Method selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["file", "paste"] as UploadMethod[]).map((m) => {
          const isActive = method === m;
          const label =
            m === "file"
              ? CLIENT_IMPORT.upload.methodFile
              : CLIENT_IMPORT.upload.methodPaste;
          const desc =
            m === "file"
              ? CLIENT_IMPORT.upload.methodFileDesc
              : CLIENT_IMPORT.upload.methodPasteDesc;
          const Icon = m === "file" ? Upload : ClipboardList;

          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                setError(null);
              }}
              className="flex items-start gap-3 rounded-2xl border p-4 text-right transition-all"
              style={{
                background: isActive ? "rgba(172,92,127,0.07)" : "var(--surface)",
                borderColor: isActive
                  ? "rgba(172,92,127,0.40)"
                  : "var(--border)",
                boxShadow: isActive
                  ? "0 0 0 2px rgba(172,92,127,0.12)"
                  : "none",
              }}
            >
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: isActive
                    ? "rgba(172,92,127,0.15)"
                    : "var(--border)",
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: isActive ? "#ac5c7f" : "var(--muted)" }}
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {label}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  {desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* File upload */}
      {method === "file" && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 transition-colors"
            style={{
              borderColor: fileName
                ? "rgba(172,92,127,0.40)"
                : "var(--border)",
              background: fileName
                ? "rgba(172,92,127,0.04)"
                : "var(--surface)",
            }}
          >
            <Upload
              className="h-8 w-8"
              style={{ color: fileName ? "#ac5c7f" : "var(--muted)" }}
            />
            {fileName ? (
              <span className="text-sm font-medium" style={{ color: "#ac5c7f" }}>
                {CLIENT_IMPORT.upload.fileSelected(fileName)}
              </span>
            ) : (
              <>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  {CLIENT_IMPORT.upload.fileBrowse}
                </span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {CLIENT_IMPORT.upload.fileHint}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Paste textarea */}
      {method === "paste" && (
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            {CLIENT_IMPORT.upload.pasteLabel}
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={CLIENT_IMPORT.upload.pastePlaceholder}
            rows={8}
            dir="rtl"
            className="w-full rounded-xl border p-3 text-sm leading-relaxed outline-none transition-colors focus:ring-2"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
              resize: "vertical",
            }}
          />
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {CLIENT_IMPORT.upload.pasteHint}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.20)",
            color: "#991b1b",
          }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Next */}
      <div className="flex justify-start">
        <Button
          onClick={handleNext}
          disabled={processing}
          style={{
            background: "linear-gradient(135deg,#c76f93 0%,#ac5c7f 100%)",
            color: "#fff",
          }}
        >
          {processing
            ? CLIENT_IMPORT.upload.processingButton
            : CLIENT_IMPORT.upload.nextButton}
          <ArrowLeft className="mr-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Column mapping (CSV only)
// ---------------------------------------------------------------------------

function StepMapping({
  headers,
  rows,
  initialMap,
  onNext,
  onBack,
}: {
  headers: string[];
  rows: Record<string, string>[];
  initialMap: ColumnMap;
  onNext: (map: ColumnMap) => void;
  onBack: () => void;
}) {
  const [map, setMap] = useState<ColumnMap>(initialMap);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const previewRows = rows.slice(0, 3);
  const notMapped = CLIENT_IMPORT.mapping.notMapped;

  const handleNext = () => {
    const errs: { name?: string; phone?: string } = {};
    if (!map.name) errs.name = CLIENT_IMPORT.mapping.nameRequired;
    if (!map.phone) errs.phone = CLIENT_IMPORT.mapping.phoneRequired;
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onNext(map);
  };

  const fieldSelect = (
    field: keyof ColumnMap,
    label: string,
    required: boolean,
  ) => (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--foreground)" }}>
        {label}
        <span className="font-normal" style={{ color: required ? "#ac5c7f" : "var(--muted)" }}>
          {required
            ? CLIENT_IMPORT.mapping.required
            : CLIENT_IMPORT.mapping.optional}
        </span>
      </label>
      <select
        value={map[field] ?? ""}
        onChange={(e) => {
          setMap((prev) => ({
            ...prev,
            [field]: e.target.value || null,
          }));
          setErrors((prev) => ({ ...prev, [field]: undefined }));
        }}
        dir="rtl"
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{
          borderColor:
            errors[field as "name" | "phone"]
              ? "rgba(239,68,68,0.50)"
              : "var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
        }}
      >
        <option value="">{notMapped}</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      {errors[field as "name" | "phone"] && (
        <p className="text-xs" style={{ color: "#991b1b" }}>
          {errors[field as "name" | "phone"]}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3
          className="mb-4 text-sm font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          {CLIENT_IMPORT.mapping.title}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fieldSelect("name", CLIENT_IMPORT.mapping.fieldName, true)}
          {fieldSelect("phone", CLIENT_IMPORT.mapping.fieldPhone, true)}
          {fieldSelect("email", CLIENT_IMPORT.mapping.fieldEmail, false)}
          {fieldSelect("notes", CLIENT_IMPORT.mapping.fieldNotes, false)}
        </div>
      </div>

      {/* Preview of first 3 rows */}
      {previewRows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <div
            className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
            style={{
              background: "rgba(247,238,243,0.6)",
              color: "var(--muted)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {CLIENT_IMPORT.mapping.previewTitle}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-right text-xs font-semibold"
                      style={{ color: "var(--muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom:
                        i < previewRows.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  >
                    {headers.map((h) => (
                      <td
                        key={h}
                        className="px-3 py-2 text-right"
                        style={{ color: "var(--foreground-soft)" }}
                      >
                        {row[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} size="sm">
          {CLIENT_IMPORT.mapping.backButton}
        </Button>
        <Button
          onClick={handleNext}
          style={{
            background: "linear-gradient(135deg,#c76f93 0%,#ac5c7f 100%)",
            color: "#fff",
          }}
        >
          {CLIENT_IMPORT.mapping.nextButton}
          <ArrowLeft className="mr-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Preview
// ---------------------------------------------------------------------------

function StepPreview({
  rows,
  onImport,
  onBack,
  isImporting,
}: {
  rows: PreviewRow[];
  onImport: (validRows: PreviewRow[]) => void;
  onBack: () => void;
  isImporting: boolean;
}) {
  const validRows = rows.filter((r) => r.status === "valid");
  const duplicateRows = rows.filter(
    (r) => r.status === "in_file_duplicate",
  );
  const invalidRows = rows.filter(
    (r) =>
      r.status !== "valid" && r.status !== "in_file_duplicate",
  );

  const hasAnyEmail = rows.some((r) => r.email);

  return (
    <div className="space-y-5">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "rgba(34,197,94,0.10)",
            color: "#166534",
            border: "1px solid rgba(34,197,94,0.20)",
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {CLIENT_IMPORT.preview.summaryValid(validRows.length)}
        </span>
        {duplicateRows.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: "rgba(184,150,10,0.10)",
              color: "#7a6400",
              border: "1px solid rgba(184,150,10,0.20)",
            }}
          >
            <Info className="h-3.5 w-3.5" />
            {CLIENT_IMPORT.preview.summaryDuplicate(duplicateRows.length)}
          </span>
        )}
        {invalidRows.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: "rgba(239,68,68,0.10)",
              color: "#991b1b",
              border: "1px solid rgba(239,68,68,0.20)",
            }}
          >
            <XCircle className="h-3.5 w-3.5" />
            {CLIENT_IMPORT.preview.summaryInvalid(invalidRows.length)}
          </span>
        )}
      </div>

      {/* Duplicate note */}
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        {CLIENT_IMPORT.preview.duplicateNote}
      </p>

      {/* No valid rows */}
      {validRows.length === 0 && (
        <div
          className="rounded-xl border px-4 py-8 text-center text-sm"
          style={{
            borderColor: "rgba(239,68,68,0.20)",
            background: "rgba(239,68,68,0.04)",
            color: "#991b1b",
          }}
        >
          {CLIENT_IMPORT.preview.noValidRows}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "linear-gradient(135deg,rgba(247,238,243,0.60) 0%,rgba(255,255,255,0) 100%)",
                  }}
                >
                  <th
                    className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted)" }}
                  >
                    {CLIENT_IMPORT.preview.columnStatus}
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted)" }}
                  >
                    {CLIENT_IMPORT.preview.columnName}
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted)" }}
                  >
                    {CLIENT_IMPORT.preview.columnPhone}
                  </th>
                  {hasAnyEmail && (
                    <th
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--muted)" }}
                    >
                      {CLIENT_IMPORT.preview.columnEmail}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom:
                        i < rows.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                      opacity: row.status !== "valid" ? 0.55 : 1,
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td
                      className="px-4 py-2.5 text-right"
                      style={{ color: "var(--foreground)" }}
                    >
                      {row.fullName || <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right"
                      dir="ltr"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      {row.phone || <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    {hasAnyEmail && (
                      <td
                        className="px-4 py-2.5 text-right"
                        style={{ color: "var(--muted)" }}
                      >
                        {row.email || "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} size="sm" disabled={isImporting}>
          {CLIENT_IMPORT.preview.backButton}
        </Button>
        <Button
          onClick={() => onImport(validRows)}
          disabled={validRows.length === 0 || isImporting}
          style={{
            background:
              validRows.length > 0
                ? "linear-gradient(135deg,#c76f93 0%,#ac5c7f 100%)"
                : undefined,
            color: validRows.length > 0 ? "#fff" : undefined,
          }}
        >
          {isImporting
            ? CLIENT_IMPORT.preview.importingButton
            : CLIENT_IMPORT.preview.importButton(validRows.length)}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Result
// ---------------------------------------------------------------------------

function StepResult({
  result,
  onReset,
}: {
  result: ImportResult;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Success card */}
      <div
        className="rounded-2xl border p-6 text-center"
        style={{
          background: "rgba(172,92,127,0.06)",
          borderColor: "rgba(172,92,127,0.22)",
        }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(172,92,127,0.12)" }}
        >
          <Users className="h-7 w-7" style={{ color: "#ac5c7f" }} />
        </div>
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          {CLIENT_IMPORT.result.title}
        </h2>

        <div className="mt-4 flex flex-col items-center gap-2">
          {result.created > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
              style={{
                background: "rgba(34,197,94,0.10)",
                color: "#166534",
                border: "1px solid rgba(34,197,94,0.20)",
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              {CLIENT_IMPORT.result.created(result.created)}
            </span>
          )}
          {result.duplicates > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
              style={{
                background: "rgba(184,150,10,0.10)",
                color: "#7a6400",
                border: "1px solid rgba(184,150,10,0.20)",
              }}
            >
              <Info className="h-4 w-4" />
              {CLIENT_IMPORT.result.duplicates(result.duplicates)}
            </span>
          )}
          {result.failed > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
              style={{
                background: "rgba(239,68,68,0.10)",
                color: "#991b1b",
                border: "1px solid rgba(239,68,68,0.20)",
              }}
            >
              <XCircle className="h-4 w-4" />
              {CLIENT_IMPORT.result.failed(result.failed)}
            </span>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/clients" className="flex-1">
          <button
            type="button"
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg,#c76f93 0%,#ac5c7f 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(172,92,127,0.25)",
            }}
          >
            {CLIENT_IMPORT.result.ctaViewClients}
          </button>
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
          style={{
            borderColor: "var(--border)",
            color: "var(--foreground-soft)",
            background: "var(--surface)",
          }}
        >
          {CLIENT_IMPORT.result.ctaImportMore}
        </button>
        <Link href="/bring-back" className="flex-1">
          <button
            type="button"
            className="w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
            style={{
              borderColor: "rgba(172,92,127,0.30)",
              color: "#ac5c7f",
              background: "rgba(172,92,127,0.06)",
            }}
          >
            {CLIENT_IMPORT.result.ctaBringBack}
          </button>
        </Link>
      </div>

      {/* Bring-back note */}
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{
          background: "rgba(172,92,127,0.05)",
          border: "1px solid rgba(172,92,127,0.15)",
          color: "var(--foreground-soft)",
        }}
      >
        <Info className="inline-block h-3.5 w-3.5 ml-1.5 mb-0.5" style={{ color: "#ac5c7f" }} />
        {CLIENT_IMPORT.result.bringBackNote}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({
    name: null,
    phone: null,
    email: null,
    notes: null,
  });
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleUploadNext = (
    method: UploadMethod,
    headers: string[],
    rows: Record<string, string>[],
    pasteRows: PreviewRow[],
  ) => {
    if (method === "paste") {
      setPreviewRows(pasteRows);
      setStep("preview");
    } else {
      setCsvHeaders(headers);
      setCsvRows(rows);
      const detected = autoDetectColumnMap(headers);
      setColumnMap(detected);
      setStep("mapping");
    }
  };

  const handleMappingNext = (map: ColumnMap) => {
    setColumnMap(map);
    const built = buildPreviewFromCSV(csvRows, map);
    setPreviewRows(built);
    setStep("preview");
  };

  const handleMappingBack = () => {
    setStep("upload");
  };

  const handlePreviewBack = () => {
    if (csvHeaders.length > 0) {
      setStep("mapping");
    } else {
      setStep("upload");
    }
  };

  const handleImport = async (validRows: PreviewRow[]) => {
    setIsImporting(true);
    try {
      const result = await importClients(
        validRows.map((r) => ({
          fullName: r.fullName,
          phone: r.phone,
          email: r.email || undefined,
          notes: r.notes || undefined,
        })),
      );
      setImportResult(result);
      setStep("result");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMap({ name: null, phone: null, email: null, notes: null });
    setPreviewRows([]);
    setImportResult(null);
    setStep("upload");
  };

  return (
    <div className="space-y-6">
      {/* Stepper (hide on result) */}
      {step !== "result" && (
        <div
          className="rounded-2xl border px-5 py-4"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Stepper current={step} />
        </div>
      )}

      {/* Step content */}
      <div
        className="rounded-2xl border px-5 py-6"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {step === "upload" && <StepUpload onNext={handleUploadNext} />}
        {step === "mapping" && (
          <StepMapping
            headers={csvHeaders}
            rows={csvRows}
            initialMap={columnMap}
            onNext={handleMappingNext}
            onBack={handleMappingBack}
          />
        )}
        {step === "preview" && (
          <StepPreview
            rows={previewRows}
            onImport={handleImport}
            onBack={handlePreviewBack}
            isImporting={isImporting}
          />
        )}
        {step === "result" && importResult && (
          <StepResult result={importResult} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
