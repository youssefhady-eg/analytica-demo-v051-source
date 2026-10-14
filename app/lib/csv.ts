import Papa, { type ParseResult, type Parser } from "papaparse";
import type { CsvTables } from "./types";
import { canonicalHeader } from "./aliases";

/** Phase 6 — hardened merchant-CSV parsing.
 *
 *  P6-01 delimiters (auto , ; tab) + encodings (BOM strip kept, U+FFFD warn).
 *  P6-03 header aliases (generic only) with per-file applied-alias info lines.
 *  P6-02 numbers (1,234.50 / 1.234,50 / EGP 1,234 / 1 234 / trailing %;
 *  ambiguous rejected with row) and dates (ISO, dd/mm/yyyy, yyyy/mm/dd, ISO
 *  with time → ISO; ambiguous day/month warned) normalized in place, so
 *  compute.ts keeps working unchanged.
 *  P6-04 every problem names file + row + value, capped at 10 per file.
 */

export const REQUIRED_COLS: Record<string, string[]> = {
  spend: ["adset_id", "adset_name", "channel", "spend_egp", "platform_roas"],
  orders: ["order_id", "adset_id", "order_value_egp", "courier_status"],
};
export const OPTIONAL_COLS: Record<string, string[]> = {
  ads: [
    "ad_id",
    "ad_name",
    "adset_id",
    "spend_egp",
    "platform_roas",
    "frequency",
    "ctr_14d_ago",
    "ctr_now",
  ],
  daily: [
    "date",
    "adset_id",
    "spend_egp",
    "platform_roas",
    "cpc_egp",
    "ctr_pct",
    "aov_egp",
    "failed_delivery_rate_pct",
  ],
  funnel: ["date", "channel", "step", "count"],
};

/** Extra known (optional) columns beyond the required/optional header sets. */
const EXTRA_COLS: Record<string, string[]> = {
  spend: [],
  orders: ["cogs_egp", "shipping_cost_egp", "return_shipping_egp", "ad_id"],
  ads: ["impressions", "clicks"],
  daily: [],
  funnel: [],
};

const NUMERIC_COLS: Record<string, string[]> = {
  spend: ["spend_egp", "platform_roas"],
  orders: ["order_value_egp", "cogs_egp", "shipping_cost_egp", "return_shipping_egp"],
  ads: [
    "spend_egp",
    "platform_roas",
    "frequency",
    "ctr_14d_ago",
    "ctr_now",
    "impressions",
    "clicks",
  ],
  daily: [
    "spend_egp",
    "platform_roas",
    "cpc_egp",
    "ctr_pct",
    "aov_egp",
    "failed_delivery_rate_pct",
  ],
  funnel: ["count"],
};

const DATE_COLS: Record<string, string[]> = {
  daily: ["date"],
  funnel: ["date"],
};

/** P6-04 cap: at most this many row problems per file, then a remainder line. */
export const MAX_ROW_PROBLEMS = 10;

export interface ParsedFile {
  key: keyof CsvTables;
  rows: Record<string, string>[];
  /** Physical file line per row (header is line 1; exact on the sync path). */
  rowNums: number[];
  errors: string[];
  warnings: string[];
  /** P6-04 info level (aliases applied, formats detected, blank rows). */
  infos: string[];
  /** Chunked-parse cancellation (large files only). */
  cancelled?: boolean;
}

export const CANCELLED = Symbol("csv-parse-cancelled");

/** P6-01: sniff , ; or tab from the first lines (raw count — good enough to
 *  pick among exactly these three; Papa validates the rest). */
export function detectDelimiter(text: string): { char: string; name: string } {
  const sample = text
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 5)
    .join("\n");
  const counts: Array<[string, string, number]> = [
    [",", ",", (sample.match(/,/g) || []).length],
    [";", ";", (sample.match(/;/g) || []).length],
    ["\t", "tab", (sample.match(/\t/g) || []).length],
  ];
  counts.sort((a, b) => b[2] - a[2]);
  return { char: counts[0][0], name: counts[0][1] };
}

/** P6-02: human-written numbers → float. Ambiguous shapes are rejected
 *  (caller reports file + row), never guessed. In `;`-delimited files the
 *  comma is unambiguously the decimal separator (Excel locales). */
export function parseNumValue(
  raw: string,
  opts: { decimalComma?: boolean } = {}
): { ok: true; value: number } | { ok: false } {
  let s = raw.trim().replace(/[\u2212\u2013\u2014]/g, "-");
  if (s === "") return { ok: false };
  s = s.replace(/[\s\u00a0\u2009\u202f]+/g, "");
  if (s.endsWith("%")) s = s.slice(0, -1);
  s = s.replace(/^[^\d\-,.]+/, "").replace(/[^\d.,]+$/, "");
  if (!/^-?[\d.,]+$/.test(s)) return { ok: false };
  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (s.includes("-") || s === "" || s === "." || s === ",") return { ok: false };
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  const decimalComma = opts.decimalComma === true;
  let num: string | null = null;
  if (dots > 0 && commas > 0) {
    // Both present: the LAST separator is the decimal one.
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    num = s
      .split("")
      .filter((ch) => /\d/.test(ch) || ch === dec)
      .join("")
      .replace(dec, ".");
  } else if (commas > 0) {
    if (decimalComma && /^-?\d+,\d+$/.test(s)) num = s.replace(",", ".");
    // "1,234" (thousands) accepted; "12,5" / "1,2345" ambiguous → reject.
    else if (/^\d{1,3}(,\d{3})+$/.test(s)) num = s.replace(/,/g, "");
    else return { ok: false };
  } else if (dots > 1) {
    // "1.234.567" reads as thousands; anything else dotted is malformed.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) num = s.replace(/\./g, "");
    else return { ok: false };
  } else {
    // One dot or none: a plain decimal ("3.351", "0.824"). Exception: in
    // `;`-delimited files the dot is the thousands separator, so "1.234"
    // reads as 1234 there. (In comma/tab files a bare "1.234" is decimal —
    // thousands without any decimal marker don't occur there.)
    if (decimalComma && /^\d{1,3}\.\d{3}$/.test(s)) num = s.replace(/\./g, "");
    else num = s;
  }
  const v = parseFloat((neg ? "-" : "") + num);
  return Number.isFinite(v) ? { ok: true, value: v } : { ok: false };
}

export interface ParsedDate {
  iso: string;
  format: string;
  /** dd/mm value whose day is ≤ 12 — also readable as mm/dd. */
  ambiguousOrder: boolean;
}

function validDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** P6-02: supported dates → ISO yyyy-mm-dd. Anything else is rejected. */
export function parseDateValue(raw: string): { ok: true; date: ParsedDate } | { ok: false } {
  const s = raw.trim();
  let m: RegExpMatchArray | null;
  if (
    (m = s.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
    ))
  ) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (!validDate(y, mo, d)) return { ok: false };
    return {
      ok: true,
      date: {
        iso: `${m[1]}-${m[2]}-${m[3]}`,
        format: s.length > 10 ? "ISO with time" : "ISO (yyyy-mm-dd)",
        ambiguousOrder: false,
      },
    };
  }
  if ((m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/))) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (!validDate(y, mo, d)) return { ok: false };
    return {
      ok: true,
      date: { iso: `${m[1]}-${m[2]}-${m[3]}`, format: "yyyy/mm/dd", ambiguousOrder: false },
    };
  }
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    const dd = +m[1];
    const mm = +m[2];
    const yyyy = +m[3];
    if (!validDate(yyyy, mm, dd)) return { ok: false };
    return {
      ok: true,
      date: {
        iso: `${m[3]}-${m[2]}-${m[1]}`,
        format: "dd/mm/yyyy",
        ambiguousOrder: dd <= 12 && mm <= 12,
      },
    };
  }
  return { ok: false };
}

interface HeaderMap {
  /** Canonical key per column position. */
  cols: (string | null)[];
  infos: string[];
  warnings: string[];
  errors: string[];
}

/** P6-03: resolve raw headers to canonical columns (alias-aware). */
function mapHeaders(key: keyof CsvTables, label: string, rawCols: string[]): HeaderMap {
  const infos: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const needed = key in REQUIRED_COLS ? REQUIRED_COLS[key as string] : OPTIONAL_COLS[key as string];
  const known = [...needed, ...(EXTRA_COLS[key as string] ?? [])];
  const seenCanonical = new Set<string>();
  const cols = rawCols.map((raw) => {
    // Duplicate (raw or alias) headers: first occurrence kept.
    const canonical = canonicalHeader(raw, known) ?? raw.trim().toLowerCase();
    if (seenCanonical.has(canonical)) {
      warnings.push(
        `${label}: duplicate columns ("${raw}" also maps to ${canonical}) — first occurrence kept`
      );
      return null;
    }
    seenCanonical.add(canonical);
    if (canonical !== raw.trim().toLowerCase()) {
      infos.push(`${label}: matched "${raw}" → ${canonical}`);
    }
    return canonical;
  });
  const missing = needed.filter((c) => !seenCanonical.has(c));
  if (missing.length > 0) {
    errors.push(`${label}: missing columns: ${missing.join(", ")}`);
  }
  return { cols, infos, warnings, errors };
}

interface RowProblems {
  errors: string[];
  overflow: number;
}

function pushProblem(label: string, p: RowProblems, msg: string) {
  void label;
  if (p.errors.length < MAX_ROW_PROBLEMS) p.errors.push(msg);
  else p.overflow += 1;
}

/** Validate + normalize one parsed row (shared by the sync and chunk paths). */
function normalizeRow(
  key: keyof CsvTables,
  label: string,
  cols: (string | null)[],
  raw: Record<string, string>,
  rawCols: string[],
  line: number,
  p: RowProblems,
  dateFormats: Set<string>,
  ambiguousDates: { n: number },
  decimalComma: boolean
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (let i = 0; i < rawCols.length; i++) {
    const canonical = cols[i];
    if (!canonical) continue;
    out[canonical] = raw[rawCols[i]] ?? "";
  }
  // Drop unknown-extra keys? Keep only known columns — the canonical contract.
  const known = new Set([
    ...(key in REQUIRED_COLS ? REQUIRED_COLS[key as string] : OPTIONAL_COLS[key as string]),
    ...(EXTRA_COLS[key as string] ?? []),
  ]);
  for (const k of Object.keys(out)) {
    if (!known.has(k)) delete out[k];
  }
  for (const col of NUMERIC_COLS[key as string] ?? []) {
    const v = out[col];
    if (v === undefined || v.trim() === "") continue; // blanks keep compute.ts defaults
    const parsed = parseNumValue(v, { decimalComma });
    if (parsed.ok) out[col] = String(parsed.value);
    else pushProblem(label, p, `${label} row ${line}: ${col} has an unreadable value '${v}'`);
  }
  for (const col of DATE_COLS[key as string] ?? []) {
    const v = (out[col] ?? "").trim();
    if (v === "") {
      pushProblem(label, p, `${label} row ${line}: ${col} is blank`);
      continue;
    }
    const parsed = parseDateValue(v);
    if (parsed.ok) {
      out[col] = parsed.date.iso;
      dateFormats.add(parsed.date.format);
      if (parsed.date.ambiguousOrder) ambiguousDates.n += 1;
    } else {
      pushProblem(
        label,
        p,
        `${label} row ${line}: ${col} has an unsupported date '${v}' (use ISO, dd/mm/yyyy or yyyy/mm/dd)`
      );
    }
  }
  return out;
}

function isBlankRow(r: Record<string, string>): boolean {
  return Object.values(r).every((v) => (v ?? "").trim() === "");
}

/** Parse one CSV file's text; validate required columns for required files.
 *  Hardened for real merchant exports: strips UTF-8 BOM, lowercases/trims
 *  headers, resolves generic aliases, skips blank rows (counted), validates
 *  numbers/dates per row with file + line, normalizes values in place. */
export function parseCsv(key: keyof CsvTables, text: string): ParsedFile {
  const label = `${key}.csv`;
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];
  const fail = (extraErrors: string[] = []): ParsedFile => ({
    key,
    rows: [],
    rowNums: [],
    errors: [...errors, ...extraErrors],
    warnings,
    infos,
  });

  if (text.includes("�")) {
    warnings.push(
      `${label}: replacement characters found — the file may not be UTF-8. Re-save as CSV UTF-8 and reload.`
    );
  }
  // BOM from Excel exports would otherwise corrupt the first header name
  const clean = text.replace(/^\uFEFF/, "");
  const { char: delimiter, name: delimName } = detectDelimiter(clean);
  infos.push(`${label}: delimiter "${delimName}" detected`);

  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: false,
    delimiter,
    // Trim only — casing is preserved so alias info lines quote real headers.
    transformHeader: (h) => h.trim(),
  });
  const rawCols = result.meta.fields ?? [];
  const hm = mapHeaders(key, label, rawCols);
  infos.push(...hm.infos);
  warnings.push(...hm.warnings);
  if (hm.errors.length > 0) return fail(hm.errors);
  if (rawCols.length === 0) return fail([`${label}: no header row found`]);

  // Papa FieldMismatch errors carry the 0-based data index in `row` — blank
  // lines (skipped below) are forgiven, anything else is a hard error.
  const blankIdx = new Set<number>();
  result.data.forEach((r, i) => {
    if (isBlankRow(r)) blankIdx.add(i);
  });
  const fatal = result.errors.filter((e) => typeof e.row !== "number" || !blankIdx.has(e.row));
  if (fatal.length > 0) {
    return fail([`${label}: ${fatal[0].message} (row ${(fatal[0].row ?? 0) + 2})`]);
  }

  const rows: Record<string, string>[] = [];
  const rowNums: number[] = [];
  const problems: RowProblems = { errors: [], overflow: 0 };
  const dateFormats = new Set<string>();
  const ambiguousDates = { n: 0 };
  let blanks = 0;
  const endsWithNewline = /(\r\n|\r|\n)$/.test(clean);
  result.data.forEach((r, i) => {
    if (blankIdx.has(i)) {
      // The artifact of a trailing newline is not a "skipped row".
      if (!(i === result.data.length - 1 && endsWithNewline)) blanks += 1;
      return;
    }
    const line = i + 2; // exact physical line: header is line 1
    const row = normalizeRow(
      key,
      label,
      hm.cols,
      r,
      rawCols,
      line,
      problems,
      dateFormats,
      ambiguousDates,
      delimiter === ";"
    );
    if (row) {
      rows.push(row);
      rowNums.push(line);
    }
  });
  if (blanks > 0) infos.push(`${label}: skipped ${blanks} blank row(s)`);
  if (rows.length === 0) return fail([`${label}: no data rows found`]);
  if (dateFormats.size > 0) {
    infos.push(`${label}: date format(s) detected: ${Array.from(dateFormats).join(", ")}`);
  }
  if (ambiguousDates.n > 0) {
    warnings.push(
      `${label}: day/month order ambiguous in ${ambiguousDates.n} value(s) — read as dd/mm/yyyy`
    );
  }
  errors.push(...problems.errors);
  if (problems.overflow > 0) {
    errors.push(`${label}: …and ${problems.overflow} more row problem(s)`);
  }
  return { key, rows, rowNums, errors, warnings, infos };
}

/** P6-06: chunked parse for large files (progress + cancellation). Row
 *  numbers count kept data rows here (documented approximation at scale). */
export async function parseCsvLarge(
  key: keyof CsvTables,
  text: string,
  onProgress?: (fraction: number) => void,
  isCancelled?: () => boolean
): Promise<ParsedFile> {
  const label = `${key}.csv`;
  const clean = text.replace(/^\uFEFF/, "");
  const { char: delimiter } = detectDelimiter(clean);
  const needed = key in REQUIRED_COLS ? REQUIRED_COLS[key as string] : OPTIONAL_COLS[key as string];
  const known = [...needed, ...(EXTRA_COLS[key as string] ?? [])];
  const rows: Record<string, string>[] = [];
  const rowNums: number[] = [];
  const problems: RowProblems = { errors: [], overflow: 0 };
  const dateFormats = new Set<string>();
  const ambiguousDates = { n: 0 };
  const infos: string[] = [`${label}: delimiter detected (large-file chunked parse)`];
  const warnings: string[] = [];
  let header: HeaderMap | null = null;
  let rawCols: string[] = [];
  let kept = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      Papa.parse<Record<string, string>>(clean, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        transformHeader: (h) => h.trim(),
        chunkSize: 1024 * 1024,
        chunk: (res: ParseResult<Record<string, string>>, parser: Parser) => {
          parser.pause();
          if (!header) {
            rawCols = res.meta.fields ?? [];
            header = mapHeaders(key, label, rawCols);
            infos.push(...header.infos);
            warnings.push(...header.warnings);
            if (header.errors.length > 0 || rawCols.length === 0) {
              reject(new Error(header.errors[0] ?? `${label}: no header row found`));
              return;
            }
          }
          const hm = header;
          const decimalComma = delimiter === ";";
          res.data.forEach((r) => {
            if (isBlankRow(r)) return;
            kept += 1;
            const row = normalizeRow(
              key,
              label,
              hm.cols,
              r,
              rawCols,
              kept + 1,
              problems,
              dateFormats,
              ambiguousDates,
              decimalComma
            );
            if (row) {
              rows.push(row);
              rowNums.push(kept + 1);
            }
          });
          onProgress?.(Math.min(0.99, (res.meta.cursor ?? 0) / Math.max(1, clean.length)));
          if (isCancelled?.()) {
            reject(CANCELLED);
            return;
          }
          setTimeout(() => parser.resume(), 0);
        },
        complete: () => resolve(),
        error: (e: Error) => reject(e),
      });
    });
  } catch (e) {
    if (e === CANCELLED) {
      return { key, rows: [], rowNums: [], errors: [], warnings: [], infos, cancelled: true };
    }
    if (e instanceof Error) {
      return { key, rows: [], rowNums: [], errors: [e.message], warnings, infos };
    }
    throw e;
  }
  if (rows.length === 0) {
    return {
      key,
      rows: [],
      rowNums: [],
      errors: [`${label}: no data rows found`],
      warnings,
      infos,
    };
  }
  if (dateFormats.size > 0)
    infos.push(`${label}: date format(s) detected: ${Array.from(dateFormats).join(", ")}`);
  if (ambiguousDates.n > 0) {
    warnings.push(
      `${label}: day/month order ambiguous in ${ambiguousDates.n} value(s) — read as dd/mm/yyyy`
    );
  }
  const errors = [...problems.errors];
  if (problems.overflow > 0) errors.push(`${label}: …and ${problems.overflow} more row problem(s)`);
  return { key, rows, rowNums, errors, warnings, infos };
}

/** Which of the five files the user actually provided. */
export type ProvidedFiles = Record<keyof CsvTables, boolean>;
