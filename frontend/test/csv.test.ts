import { describe, expect, it } from "vitest";
import { parseCustomsCsv, splitCsv, SAMPLE_CSV } from "../src/csv";
import { CUSTOMS_IMPORT_MAX_ROWS } from "../src/generated/contracts";

const H = "sb_number,port_code,sb_date,customs_status,observed_on";

describe("customs CSV parser", () => {
  it("parses the sample", () => {
    const r = parseCustomsCsv(SAMPLE_CSV);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1]).toEqual({
      sb_number: "SYNTHETIC-1000002",
      port_code: "INMAA1",
      sb_date: "2026-10-02",
      customs_status: "REALISED",
      observed_on: "2026-10-21",
    });
  });
  it("accepts case-insensitive header and status, whitespace, CRLF and blank lines", () => {
    const r = parseCustomsCsv(
      " SB_Number , Port_Code,SB_DATE,Customs_Status,Observed_On\r\n\r\n 1 , INMAA1 , 2026-10-01 , pending , 2026-10-02 \r\n\r\n",
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { sb_number: "1", port_code: "INMAA1", sb_date: "2026-10-01", customs_status: "PENDING", observed_on: "2026-10-02" },
    ]);
  });
  it("supports quoted fields with commas, quotes and a BOM", () => {
    expect(splitCsv('﻿a,"b,c","d ""e"""\n')).toEqual([{ line: 1, fields: ["a", "b,c", 'd "e"'] }]);
    const r = parseCustomsCsv(`${H}\n"A,1",INMAA1,2026-10-01,REALISED,2026-10-02`);
    expect(r.rows[0].sb_number).toBe("A,1");
  });
  it("reports per-line errors with line numbers", () => {
    const r = parseCustomsCsv(
      `${H}\n1,INMAA1,2026-13-01,DONE,2026-10-02\n\n2,INMAA1,2026-10-01\n,INMAA1,2026-10-01,PENDING,2026-10-0`,
    );
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 4, 5]);
    expect(r.errors[0].message).toMatch(/sb_date.*customs_status/);
    expect(r.errors[1].message).toMatch(/columns/);
    expect(r.errors[2].message).toMatch(/sb_number is empty.*observed_on/);
  });
  it("rejects a wrong header and empty input", () => {
    expect(parseCustomsCsv("a,b,c").errors[0].message).toMatch(/Header must be/);
    expect(parseCustomsCsv("  \n").errors).toHaveLength(1);
    expect(parseCustomsCsv(H).errors[0].message).toMatch(/No data rows/);
  });
  it("refuses more than the maximum number of rows", () => {
    const lines = Array.from({ length: CUSTOMS_IMPORT_MAX_ROWS + 1 }, (_, i) => `S${i},P,2026-10-01,PENDING,2026-10-02`);
    const r = parseCustomsCsv([H, ...lines].join("\n"));
    expect(r.rows).toEqual([]);
    expect(r.errors[0].message).toMatch(/Too many rows/);
    const ok = parseCustomsCsv([H, ...lines.slice(0, CUSTOMS_IMPORT_MAX_ROWS)].join("\n"));
    expect(ok.rows).toHaveLength(CUSTOMS_IMPORT_MAX_ROWS);
  });
});
