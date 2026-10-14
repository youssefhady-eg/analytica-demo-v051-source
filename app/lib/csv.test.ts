/**
 * Phase 6 — hardening tests (P6-01…P6-05, P6-08).
 *
 * Fixture behaviors (scripts/fixtures/csv/), number/date normalization
 * tables, the sample round-trip (headlines reproduce exactly) and the
 * compute.ts ⇄ ingest_csvs.py parity check (skipped visibly w/o Python).
 *
 * Run:  npx vitest run   (or: npm test)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  parseCsv,
  parseCsvLarge,
  parseDateValue,
  parseNumValue,
} from "./csv";
import type { CsvTables } from "./types";
import { computeFromCsv } from "./compute";
import { buildCases } from "./cases";
import { buildSampleCsvs } from "./templates";
import { sampleData } from "./data";

const FIX = join(__dirname, "..", "scripts", "fixtures", "csv");
const read = (n: string): string => readFileSync(join(FIX, n), "utf8");

function tables(spendFile: string, ordersFile: string): { t: CsvTables; rows: Record<string, number[]> } {
  const spend = parseCsv("spend", read(spendFile));
  const orders = parseCsv("orders", read(ordersFile));
  expect(spend.errors).toEqual([]);
  expect(orders.errors).toEqual([]);
  return {
    t: { spend: spend.rows, orders: orders.rows, ads: [], daily: [], funnel: [] },
    rows: { spend: spend.rowNums, orders: orders.rowNums },
  };
}

describe("parseNumValue (P6-02)", () => {
  const cases: Array<[string, number | null]> = [
    ["1,234.50", 1234.5],
    ["1.234,50", 1234.5],
    ["EGP 1,234", 1234],
    ["1 234", 1234],
    ["1\u00a0234", 1234],
    ["12%", 12],
    ["3.0", 3],
    ["-5", -5],
    ["0", 0],
    ["12,5", null], // ambiguous: 12.5 or 125?
    ["1,2345", null], // ambiguous grouping
    ["1.234.567", 1234567], // thousands grouping
    ["3.351", 3.351], // ordinary 3-decimal numbers parse as decimals
    ["abc", null],
    ["", null],
    ["--5", null],
  ];
  for (const [raw, expected] of cases) {
    test(`"${raw}" → ${expected}`, () => {
      const r = parseNumValue(raw);
      if (expected === null) expect(r.ok).toBe(false);
      else {
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toBeCloseTo(expected, 9);
      }
    });
  }
  test("semicolon files read comma decimals and dot thousands", () => {
    expect(parseNumValue("3,0", { decimalComma: true })).toEqual({ ok: true, value: 3 });
    expect(parseNumValue("1.234", { decimalComma: true })).toEqual({ ok: true, value: 1234 });
  });
});

describe("parseDateValue (P6-02)", () => {
  test("ISO, dd/mm/yyyy, yyyy/mm/dd, ISO with time → ISO", () => {
    expect(parseDateValue("2026-09-01")).toEqual({
      ok: true,
      date: { iso: "2026-09-01", format: "ISO (yyyy-mm-dd)", ambiguousOrder: false },
    });
    expect(parseDateValue("25/12/2026").ok).toBe(true);
    if (parseDateValue("25/12/2026").ok) {
      const d = (parseDateValue("25/12/2026") as { ok: true; date: { iso: string } }).date;
      expect(d.iso).toBe("2026-12-25");
    }
    expect(parseDateValue("2026/09/01")).toEqual({
      ok: true,
      date: { iso: "2026-09-01", format: "yyyy/mm/dd", ambiguousOrder: false },
    });
    const t = parseDateValue("2026-09-01T10:00:00");
    expect(t.ok).toBe(true);
  });
  test("ambiguous day/month order is flagged but parsed day-first", () => {
    const r = parseDateValue("03/04/2026");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.date.iso).toBe("2026-04-03");
      expect(r.date.ambiguousOrder).toBe(true);
    }
  });
  test("impossible and foreign dates are rejected", () => {
    expect(parseDateValue("2026-13-01").ok).toBe(false);
    expect(parseDateValue("2026-02-30").ok).toBe(false);
    expect(parseDateValue("Sept 1 2026").ok).toBe(false);
    expect(parseDateValue("").ok).toBe(false);
  });
});

describe("fixture behaviors (P6-01…P6-05)", () => {
  test("semicolon delimiter is detected (Excel locales)", () => {
    const p = parseCsv("spend", read("spend-semicolon.csv"));
    expect(p.errors).toEqual([]);
    expect(p.rows).toHaveLength(2);
    expect(p.infos.join(" ")).toContain('delimiter ";" detected');
    expect(p.rows[0]["spend_egp"]).toBe("10000");
  });

  test("comma decimals and currency prefixes normalize", () => {
    const p = parseCsv("spend", read("spend-comma-decimal.csv"));
    expect(p.errors).toEqual([]);
    expect(p.rows[0]["spend_egp"]).toBe("10000.5");
    expect(p.rows[0]["platform_roas"]).toBe("3");
    expect(p.rows[1]["spend_egp"]).toBe("5000");
  });

  test("generic header aliases apply with an info line", () => {
    const p = parseCsv("spend", read("spend-alias-headers.csv"));
    expect(p.errors).toEqual([]);
    expect(p.rows[0]["adset_name"]).toBe("Prospecting One");
    expect(p.rows[0]["spend_egp"]).toBe("10000");
    expect(p.infos.join(" ")).toContain('matched "Amount Spent" → spend_egp');
  });

  test("BOM stripped, blank rows skipped with exact numbering after", () => {
    const p = parseCsv("spend", read("spend-bom-blanks.csv"));
    expect(p.errors).toEqual([]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]["adset_id"]).toBe("p1");
    expect(p.infos.join(" ")).toContain("blank");
  });

  test("row problems name file + row + value", async () => {
    const spend = parseCsv("spend", read("spend-clean.csv"));
    const orders = parseCsv("orders", read("orders-issues.csv"));
    // o04 "abc" value + o05 "lost" status surface as row errors.
    expect(orders.errors.length).toBeGreaterThan(0);
    expect(orders.errors.join("\n")).toContain("orders.csv row 6");
    expect(orders.errors.join("\n")).toContain("abc");
    const res = await computeFromCsv(
      { spend: spend.rows, orders: orders.rows, ads: [], daily: [], funnel: [] },
      { brand: "Fixture", cogs: 0, ship: 60, rship: 60 },
      { spend: spend.rowNums, orders: orders.rowNums }
    );
    expect(res.errors.join("\n")).toContain("orders.csv row 7");
    expect(res.errors.join("\n")).toContain("lost");
  });

  test("duplicates, orphans, zero values become capped warnings", async () => {
    const spend = parseCsv("spend", read("spend-clean.csv"));
    const stale = parseCsv("orders", read("orders-issues.csv"));
    // Computable subset: drop the fatal rows (bad value, bad status).
    const badLines = new Set(
      stale.errors.flatMap((e) => [...e.matchAll(/row (\d+)/g)].map((m) => +m[1]))
    );
    const keep = stale.rows.filter(
      (r, i) =>
        !badLines.has(stale.rowNums[i]) &&
        ["delivered", "refused", "rto", "cancelled"].includes((r["courier_status"] ?? "").toLowerCase())
    );
    const res = await computeFromCsv(
      { spend: spend.rows, orders: keep, ads: [], daily: [], funnel: [] },
      { brand: "Fixture", cogs: 0, ship: 60, rship: 60 }
    );
    expect(res.data).not.toBeNull();
    const w = res.warnings.join("\n");
    expect(w).toContain("duplicate order_id");
    expect(w).toContain("unknown adset_id");
    expect(w).toContain("zero or negative value");
  });

  test("duplicate order_id is counted once (first occurrence)", async () => {
    const spend = parseCsv("spend", read("spend-clean.csv"));
    const orders = parseCsv("orders", read("orders-duplicates.csv"));
    const res = await computeFromCsv(
      { spend: spend.rows, orders: orders.rows, ads: [], daily: [], funnel: [] },
      { brand: "Fixture", cogs: 0, ship: 60, rship: 60 }
    );
    expect(res.data).not.toBeNull();
    expect(res.warnings.join("\n")).toContain("duplicate order_id");
    const p1 = res.data!.adsets.find((a) => a.id === "p1")!;
    // o01 delivered (440) + o02 delivered (440) + o03 refused (−60); the
    // repeated o02 row is skipped, so it must not add another 440.
    expect(p1.profit_egp).toBeCloseTo(820, 6);
    expect(p1.orders).toBe(3);
  });

  test("missing ad_id linkage warns honestly", async () => {
    const { t } = tables("spend-clean.csv", "orders-no-adid.csv");
    const withAds: CsvTables = {
      ...t,
      ads: [
        {
          ad_id: "a1", ad_name: "Ad One", adset_id: "p1", spend_egp: "1000",
          platform_roas: "3.0", frequency: "2.0", ctr_14d_ago: "2.0", ctr_now: "2.0",
        },
      ],
    };
    const res = await computeFromCsv(withAds, { brand: "Fixture", cogs: 0, ship: 60, rship: 60 });
    expect(res.data).not.toBeNull();
    expect(res.data!.hasAdLinkage).toBe(false);
    expect(res.warnings.join("\n")).toContain("no ad_id column");
  });

  test("short funnel warns and skips the leak scan", async () => {
    const spend = parseCsv("spend", read("spend-clean.csv"));
    const orders = parseCsv("orders", read("orders-clean.csv"));
    const funnel = parseCsv("funnel", read("funnel-5days.csv"));
    expect(funnel.errors).toEqual([]);
    const res = await computeFromCsv(
      { spend: spend.rows, orders: orders.rows, ads: [], daily: [], funnel: funnel.rows },
      { brand: "Fixture", cogs: 0, ship: 60, rship: 60 }
    );
    expect(res.data).not.toBeNull();
    expect(res.warnings.join("\n")).toContain("< 8");
  });

  test("non-overlapping daily/funnel windows warn", async () => {
    const spend = parseCsv("spend", read("spend-clean.csv"));
    const orders = parseCsv("orders", read("orders-clean.csv"));
    const funnel = parseCsv("funnel", read("funnel-5days.csv"));
    const daily = parseCsv("daily", read("daily-c.csv"));
    const res = await computeFromCsv(
      { spend: spend.rows, orders: orders.rows, ads: [], daily: daily.rows, funnel: funnel.rows },
      { brand: "Fixture", cogs: 0, ship: 60, rship: 60 }
    );
    expect(res.data).not.toBeNull();
    expect(res.warnings.join("\n")).toContain("don't overlap");
  });
});

describe("round-trip (P6-08)", () => {
  test("sample → CSV → parse → compute reproduces the headlines", async () => {
    const csvs = buildSampleCsvs(sampleData);
    const parsed = {
      spend: parseCsv("spend", csvs.spend),
      orders: parseCsv("orders", csvs.orders),
      ads: parseCsv("ads", csvs.ads),
      daily: parseCsv("daily", csvs.daily),
      funnel: parseCsv("funnel", csvs.funnel),
    };
    for (const [k, p] of Object.entries(parsed)) {
      expect((p as { errors: string[] }).errors, k).toEqual([]);
    }
    const res = await computeFromCsv(
      {
        spend: parsed.spend.rows,
        orders: parsed.orders.rows,
        ads: parsed.ads.rows,
        daily: parsed.daily.rows,
        funnel: parsed.funnel.rows,
      },
      { brand: "Cairo Thread", cogs: 0, ship: 60, rship: 60 },
      {
        spend: parsed.spend.rowNums,
        orders: parsed.orders.rowNums,
        ads: parsed.ads.rowNums,
        daily: parsed.daily.rowNums,
        funnel: parsed.funnel.rowNums,
      }
    );
    expect(res.data).not.toBeNull();
    const d = res.data!;
    const spend = d.adsets.reduce((s, a) => s + a.spend_egp, 0);
    const profit = d.adsets.reduce((s, a) => s + a.profit_egp, 0);
    const roas = d.adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / spend;
    const poas = profit / spend;
    expect(spend).toBe(80000);
    expect(roas.toFixed(2)).toBe("3.49");
    expect(poas.toFixed(2)).toBe("1.19");
    expect((roas / poas).toFixed(2)).toBe("2.92");
    expect(buildCases(d).map((c) => c.id)).toEqual([
      "leak-tiktok-3",
      "money-lookalike-purch",
      "money-tiktok-prosp",
      "drop-spring-broad",
    ]);
  });
});

describe("parseCsvLarge (chunked path)", () => {
  test("parses a clean file with the same contract as the sync path", async () => {
    const pf = await parseCsvLarge("spend", read("spend-clean.csv"));
    expect(pf.cancelled).toBeFalsy();
    expect(pf.errors).toEqual([]);
    expect(pf.rows).toHaveLength(2);
    expect(pf.rows[0]["adset_id"]).toBe("p1");
    expect(pf.rows[0]["spend_egp"]).toBe("10000");
  });

  test("detects a semicolon delimiter", async () => {
    const pf = await parseCsvLarge("spend", read("spend-semicolon.csv"));
    expect(pf.errors).toEqual([]);
    expect(pf.rows.length).toBeGreaterThan(0);
    expect(pf.infos.join("\n")).toContain("delimiter");
  });

  test("reports an unreadable numeric value with file+row", async () => {
    const csv = "date,channel,step,count\n2024-01-01,meta,session,abc\n";
    const pf = await parseCsvLarge("funnel", csv);
    expect(pf.errors.join("\n")).toMatch(/count has an unreadable value 'abc'/);
  });

  test("normalizes dates and rejects unsupported ones", async () => {
    const csv = "date,channel,step,count\n01/02/2024,meta,session,10\n2024-13-40,meta,session,10\n";
    const pf = await parseCsvLarge("funnel", csv);
    expect(pf.rows[0]["date"]).toBe("2024-02-01");
    expect(pf.errors.join("\n")).toMatch(/unsupported date '2024-13-40'/);
  });

  test("reports an empty file as no data rows", async () => {
    const pf = await parseCsvLarge("spend", "adset_id,adset_name,channel,spend_egp,platform_roas\n");
    expect(pf.rows).toHaveLength(0);
    expect(pf.errors.join("\n")).toMatch(/no data rows found/i);
  });

  test("honors cancellation", async () => {
    const pf = await parseCsvLarge("spend", read("spend-clean.csv"), undefined, () => true);
    expect(pf.cancelled).toBe(true);
    expect(pf.rows).toHaveLength(0);
  });

  test("reports progress fractions in [0,1]", async () => {
    const seen: number[] = [];
    await parseCsvLarge("spend", read("spend-clean.csv"), (f) => seen.push(f));
    expect(seen.length).toBeGreaterThan(0);
    for (const f of seen) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe("python parity (P6-08)", () => {
  test("compute.ts and ingest_csvs.py agree within 1e-6", async () => {
    // Windows exposes Python as `py`, not `python3` — try each spelling.
    let python: string | null = null;
    for (const cand of ["py", "python", "python3"]) {
      try {
        execFileSync(cand, ["--version"], { stdio: "ignore" });
        python = cand;
        break;
      } catch {
        // try the next spelling
      }
    }
    if (!python) {
      console.warn("SKIP parity: no Python available (tried py/python/python3)");
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "analytica-parity-"));
    try {
      writeFileSync(join(dir, "spend.csv"), read("spend-clean.csv"));
      writeFileSync(join(dir, "orders.csv"), read("orders-clean.csv"));
      const outdir = join(dir, "out");
      execFileSync(
        python,
        [
          join(__dirname, "..", "ingest_csvs.py"),
          "--in",
          dir,
          "--out",
          outdir,
          "--brand",
          "Parity",
          "--cogs-default",
          "0",
          "--ship-default",
          "60",
          "--rship-default",
          "60",
        ],
        { stdio: "pipe" }
      );
      const adsets = JSON.parse(readFileSync(join(outdir, "adsets.json"), "utf8")) as {
        spend_egp: number;
        platform_roas: number;
        profit_egp: number;
      }[];
      const pySpend = adsets.reduce((s, a) => s + a.spend_egp, 0);
      const pyProfit = adsets.reduce((s, a) => s + a.profit_egp, 0);
      const pyRoas = adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / pySpend;
      const pyPoas = pyProfit / pySpend;

      const { t } = tables("spend-clean.csv", "orders-clean.csv");
      const res = await computeFromCsv(t, { brand: "Parity", cogs: 0, ship: 60, rship: 60 });
      expect(res.data).not.toBeNull();
      const tsSpend = res.data!.adsets.reduce((s, a) => s + a.spend_egp, 0);
      const tsProfit = res.data!.adsets.reduce((s, a) => s + a.profit_egp, 0);
      const tsRoas =
        res.data!.adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / tsSpend;
      const tsPoas = tsProfit / tsSpend;
      expect(Math.abs(tsSpend - pySpend)).toBeLessThan(1e-6);
      expect(Math.abs(tsRoas - pyRoas)).toBeLessThan(1e-6);
      expect(Math.abs(tsPoas - pyPoas)).toBeLessThan(1e-6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  test("compute.ts and ingest_csvs.py dedupe order_id identically", async () => {
    let python: string | null = null;
    for (const cand of ["py", "python", "python3"]) {
      try {
        execFileSync(cand, ["--version"], { stdio: "ignore" });
        python = cand;
        break;
      } catch {
        // try the next spelling
      }
    }
    if (!python) {
      console.warn("SKIP parity: no Python available (tried py/python/python3)");
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "analytica-parity-dup-"));
    try {
      writeFileSync(join(dir, "spend.csv"), read("spend-clean.csv"));
      writeFileSync(join(dir, "orders.csv"), read("orders-duplicates.csv"));
      const outdir = join(dir, "out");
      execFileSync(
        python,
        [
          join(__dirname, "..", "ingest_csvs.py"),
          "--in",
          dir,
          "--out",
          outdir,
          "--brand",
          "Parity",
          "--cogs-default",
          "0",
          "--ship-default",
          "60",
          "--rship-default",
          "60",
        ],
        { stdio: "pipe" }
      );
      const adsets = JSON.parse(readFileSync(join(outdir, "adsets.json"), "utf8")) as {
        spend_egp: number;
        profit_egp: number;
      }[];
      const pySpend = adsets.reduce((s, a) => s + a.spend_egp, 0);
      const pyProfit = adsets.reduce((s, a) => s + a.profit_egp, 0);
      const pyPoas = pyProfit / pySpend;

      const spend = parseCsv("spend", read("spend-clean.csv"));
      const orders = parseCsv("orders", read("orders-duplicates.csv"));
      const res = await computeFromCsv(
        { spend: spend.rows, orders: orders.rows, ads: [], daily: [], funnel: [] },
        { brand: "Parity", cogs: 0, ship: 60, rship: 60 }
      );
      expect(res.data).not.toBeNull();
      const tsSpend = res.data!.adsets.reduce((s, a) => s + a.spend_egp, 0);
      const tsProfit = res.data!.adsets.reduce((s, a) => s + a.profit_egp, 0);
      const tsPoas = tsProfit / tsSpend;
      expect(Math.abs(tsProfit - pyProfit)).toBeLessThan(1e-6);
      expect(Math.abs(tsPoas - pyPoas)).toBeLessThan(1e-6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
