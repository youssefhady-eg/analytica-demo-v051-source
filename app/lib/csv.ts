import Papa from "papaparse";
import type { CsvTables } from "./types";

const REQUIRED: Record<string, string[]> = {
  spend: ["adset_id", "adset_name", "channel", "spend_egp", "platform_roas"],
  orders: ["order_id", "adset_id", "order_value_egp", "courier_status"],
};
const OPTIONAL: Record<string, string[]> = {
  ads: ["ad_id", "ad_name", "adset_id", "spend_egp", "platform_roas", "frequency", "ctr_14d_ago", "ctr_now"],
  daily: ["date", "adset_id", "spend_egp", "platform_roas", "cpc_egp", "ctr_pct", "aov_egp", "failed_delivery_rate_pct"],
  funnel: ["date", "channel", "step", "count"],
};

export interface ParsedFile {
  key: keyof CsvTables;
  rows: Record<string, string>[];
  errors: string[];
  warnings: string[];
}

/** Parse one CSV file's text; validate required columns for required files.
 *  Hardened for real merchant exports: strips UTF-8 BOM, trims headers,
 *  skips blank lines, warns on duplicate headers. */
export function parseCsv(key: keyof CsvTables, text: string): ParsedFile {
  const errors: string[] = [];
  const warnings: string[] = [];
  // BOM from Excel exports would otherwise corrupt the first header name
  const clean = text.replace(/^\uFEFF/, "");
  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (result.errors.length > 0) {
    errors.push(`${key}.csv: ${result.errors[0].message}`);
    return { key, rows: [], errors, warnings };
  }
  const cols = result.meta.fields ?? [];
  const seen = new Set<string>();
  const dupes = cols.filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
  if (dupes.length > 0) {
    warnings.push(`${key}.csv: duplicate columns (${Array.from(new Set(dupes)).join(", ")}) — first occurrence kept`);
  }
  const needed = key in REQUIRED ? REQUIRED[key] : OPTIONAL[key];
  const missing = needed.filter((c) => !cols.includes(c));
  if (missing.length > 0) {
    errors.push(`${key}.csv: missing columns: ${missing.join(", ")}`);
    return { key, rows: [], errors, warnings };
  }
  const rows = result.data.filter((r) => Object.values(r).some((v) => (v ?? "").trim() !== ""));
  if (rows.length === 0) {
    errors.push(`${key}.csv: no data rows found`);
    return { key, rows: [], errors, warnings };
  }
  if (rows.length !== result.data.length) {
    warnings.push(`${key}.csv: skipped ${result.data.length - rows.length} blank row(s)`);
  }
  return { key, rows, errors, warnings };
}

/** Which of the five files the user actually provided. */
export type ProvidedFiles = Record<keyof CsvTables, boolean>;
