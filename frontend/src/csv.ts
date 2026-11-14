/** Small CSV reader for the Customs list import (N5). No dependencies. */
import { CUSTOMS_IMPORT_MAX_ROWS, CustomsStatus, type CustomsImportRow } from "./generated/contracts";

export const CSV_HEADER = ["sb_number", "port_code", "sb_date", "customs_status", "observed_on"] as const;

export const SAMPLE_CSV =
  "sb_number,port_code,sb_date,customs_status,observed_on\n" +
  "SYNTHETIC-1000001,INMAA1,2026-10-01,PENDING,2026-10-20\n" +
  "SYNTHETIC-1000002,INMAA1,2026-10-02,REALISED,2026-10-21\n";

export interface CsvLineError {
  line: number; // 1-based line in the input where the record starts
  message: string;
}

export interface CsvParseResult {
  rows: CustomsImportRow[];
  errors: CsvLineError[];
}

/** Split text into records of fields. Handles quotes, "" escapes, commas and newlines in quotes, CRLF. */
export function splitCsv(text: string): { line: number; fields: string[] }[] {
  const out: { line: number; fields: string[] }[] = [];
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let startLine = 1;
  let pending = false; // anything seen in the current record

  const endRecord = () => {
    fields.push(field);
    out.push({ line: startLine, fields });
    fields = [];
    field = "";
    pending = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (c === "\n") line++;
        field += c;
      }
      continue;
    }
    if (!pending) startLine = line;
    if (c === '"') {
      inQuotes = true;
      pending = true;
    } else if (c === ",") {
      fields.push(field);
      field = "";
      pending = true;
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (pending || field !== "") endRecord();
      line++;
    } else {
      field += c;
      pending = true;
    }
  }
  if (pending || field !== "") endRecord();
  return out;
}

function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parseCustomsCsv(text: string): CsvParseResult {
  const records = splitCsv(text).filter((r) => r.fields.some((f) => f.trim() !== ""));
  const rows: CustomsImportRow[] = [];
  const errors: CsvLineError[] = [];
  if (records.length === 0) {
    return { rows, errors: [{ line: 1, message: "No CSV text found. Expected a header and at least one row." }] };
  }
  const header = records[0].fields.map((f) => f.trim().toLowerCase());
  if (header.length !== CSV_HEADER.length || CSV_HEADER.some((h, i) => header[i] !== h)) {
    errors.push({ line: records[0].line, message: `Header must be: ${CSV_HEADER.join(",")}` });
    return { rows, errors };
  }
  const data = records.slice(1);
  if (data.length === 0) errors.push({ line: records[0].line, message: "No data rows after the header." });
  if (data.length > CUSTOMS_IMPORT_MAX_ROWS) {
    errors.push({
      line: data[CUSTOMS_IMPORT_MAX_ROWS].line,
      message: `Too many rows: ${data.length}. At most ${CUSTOMS_IMPORT_MAX_ROWS} rows per import.`,
    });
    return { rows, errors };
  }
  const statuses = Object.values(CustomsStatus) as string[];
  for (const rec of data) {
    if (rec.fields.length !== CSV_HEADER.length) {
      errors.push({ line: rec.line, message: `Expected ${CSV_HEADER.length} columns, found ${rec.fields.length}.` });
      continue;
    }
    const [sb, port, sbDate, status, observed] = rec.fields.map((f) => f.trim());
    const problems: string[] = [];
    if (!sb) problems.push("sb_number is empty");
    if (sb.length > 20) problems.push("sb_number is longer than 20 characters");
    if (!port) problems.push("port_code is empty");
    if (port.length > 10) problems.push("port_code is longer than 10 characters");
    if (!validDate(sbDate)) problems.push("sb_date must be a date as YYYY-MM-DD");
    const st = status.toUpperCase();
    if (!statuses.includes(st)) problems.push(`customs_status must be ${statuses.join(" or ")}`);
    if (!validDate(observed)) problems.push("observed_on must be a date as YYYY-MM-DD");
    if (problems.length) {
      errors.push({ line: rec.line, message: problems.join("; ") + "." });
      continue;
    }
    rows.push({ sb_number: sb, port_code: port, sb_date: sbDate, customs_status: st as CustomsStatus, observed_on: observed });
  }
  return { rows, errors };
}
