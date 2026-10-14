import type { Ad, AdSet, CsvTables, DailyRow, DemoData, FunnelRow, GapLibrary } from "./types";
import gapsJson from "@/data/gaps.json";
import { MAX_ROW_PROBLEMS } from "./csv";

/** Client-side twin of ingest_csvs.py: turns parsed merchant CSVs into the
 *  DemoData contract. POAS math mirrors A1–A5/A7 exactly like the script.
 *  Phase 6: async with progress + cancellation (P6-06) and capped
 *  data-quality warnings (P6-04/P6-05). */

const num = (v: unknown, d = 0): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : d;
};

const STATUSES = new Set(["delivered", "refused", "rto", "cancelled"]);
const FUNNEL_STEPS = new Set(["session", "add_to_cart", "checkout", "purchase"]);

export interface ComputeResult {
  data: DemoData | null;
  errors: string[];
  warnings: string[];
  cancelled?: boolean;
}

/** P6-04: collect at most MAX_ROW_PROBLEMS examples, then a remainder line. */
class Capped {
  list: string[] = [];
  total = 0;
  push(msg: string) {
    this.total += 1;
    if (this.list.length < MAX_ROW_PROBLEMS) this.list.push(msg);
  }
  flush(arr: string[], remainder: (n: number) => string) {
    arr.push(...this.list);
    if (this.total > this.list.length) arr.push(remainder(this.total - this.list.length));
  }
}

const yieldUI = () => new Promise<void>((r) => setTimeout(r, 0));

function orderProfit(
  o: Record<string, string>,
  dflt: { cogs: number; ship: number; rship: number }
): number | null {
  const st = (o["courier_status"] ?? "").trim().toLowerCase();
  const value = num(o["order_value_egp"]);
  const cogs = o["cogs_egp"] ? num(o["cogs_egp"]) : dflt.cogs;
  const ship = o["shipping_cost_egp"] ? num(o["shipping_cost_egp"]) : dflt.ship;
  const rship = o["return_shipping_egp"] ? num(o["return_shipping_egp"]) : dflt.rship;
  if (st === "delivered") return value - cogs - ship;
  if (st === "refused") return -ship;
  if (st === "rto") return -ship - rship;
  return null; // cancelled
}

export async function computeFromCsv(
  t: CsvTables,
  opts: { brand: string; cogs: number; ship: number; rship: number },
  rowNums: Partial<Record<keyof CsvTables, number[]>> = {},
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<ComputeResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rowOf = (key: keyof CsvTables, i: number): number => rowNums[key]?.[i] ?? i + 2;

  if (t.spend.length === 0) errors.push("spend.csv is required and has no data rows.");
  if (t.orders.length === 0) errors.push("orders.csv is required and has no data rows.");
  const adsetIds = new Set(t.spend.map((r) => r["adset_id"]));

  const profitByAdset = new Map<string, number>();
  const profitByAd = new Map<string, number>();
  const ordersByAdset = new Map<string, number>();
  const econByAdset = new Map<
    string,
    { revenue: number; cogs: number; ship: number; failed: number }
  >();
  const deliveredValues: number[] = [];
  const seenOrderIds = new Map<string, number>();
  let hasLinkage = false;
  let countedOrders = 0;
  let linkedOrders = 0;
  let zeroValueOrders = 0;
  let orphanOrders = 0;
  const orphanExamples: string[] = [];
  const dupExamples: string[] = [];
  const badStatus = new Capped();

  const econOf = (id: string) => {
    let e = econByAdset.get(id);
    if (!e) {
      e = { revenue: 0, cogs: 0, ship: 0, failed: 0 };
      econByAdset.set(id, e);
    }
    return e;
  };

  // P6-06: chunked with yields so a 200k-row export never freezes the tab.
  const CHUNK = 20000;
  for (let start = 0; start < t.orders.length; start += CHUNK) {
    if (isCancelled?.()) return { data: null, errors: [], warnings: [], cancelled: true };
    const end = Math.min(t.orders.length, start + CHUNK);
    for (let i = start; i < end; i++) {
      const o = t.orders[i];
      const line = rowOf("orders", i);
      const oid = (o["order_id"] ?? "").trim();
      if (oid) {
        const n = (seenOrderIds.get(oid) ?? 0) + 1;
        seenOrderIds.set(oid, n);
        if (n === 2 && dupExamples.length < MAX_ROW_PROBLEMS) dupExamples.push(oid);
        // P6-05 says "first occurrence counted" — actually skip repeats so
        // profit, order counts and economics are not double-counted.
        if (n > 1) continue;
      }
      const st = (o["courier_status"] ?? "").trim().toLowerCase();
      if (!STATUSES.has(st)) {
        badStatus.push(
          `orders.csv row ${line}: unknown courier_status '${o["courier_status"]}' (order ${o["order_id"]})`
        );
        continue;
      }
      if (!adsetIds.has(o["adset_id"])) {
        orphanOrders += 1;
        if (orphanExamples.length < MAX_ROW_PROBLEMS) {
          orphanExamples.push(`order ${o["order_id"]} → '${o["adset_id"]}' (row ${line})`);
        }
        continue;
      }
      const p = orderProfit(o, opts);
      if (p === null) continue; // cancelled
      countedOrders += 1;
      if (num(o["order_value_egp"]) <= 0) zeroValueOrders += 1;
      profitByAdset.set(o["adset_id"], (profitByAdset.get(o["adset_id"]) ?? 0) + p);
      ordersByAdset.set(o["adset_id"], (ordersByAdset.get(o["adset_id"]) ?? 0) + 1);
      const value = num(o["order_value_egp"]);
      const cogs = o["cogs_egp"] ? num(o["cogs_egp"]) : opts.cogs;
      const ship = o["shipping_cost_egp"] ? num(o["shipping_cost_egp"]) : opts.ship;
      const rship = o["return_shipping_egp"] ? num(o["return_shipping_egp"]) : opts.rship;
      const e = econOf(o["adset_id"]);
      if (st === "delivered") {
        e.revenue += value;
        e.cogs += cogs;
        e.ship += ship;
        deliveredValues.push(value);
      } else if (st === "refused") {
        e.failed += ship;
      } else if (st === "rto") {
        e.failed += ship + rship;
      }
      const adId = (o["ad_id"] ?? "").trim();
      if (adId) {
        hasLinkage = true;
        linkedOrders += 1;
        profitByAd.set(adId, (profitByAd.get(adId) ?? 0) + p);
      }
    }
    onProgress?.(end, t.orders.length);
    await yieldUI();
  }
  badStatus.flush(errors, (n) => `orders.csv: …and ${n} more unknown-status row(s)`);
  if (errors.length > 0) return { data: null, errors, warnings };

  // P6-05 data-quality warnings (capped examples, counts never dropped).
  let dupGroups = 0;
  let dupTotal = 0;
  seenOrderIds.forEach((n, id) => {
    if (n > 1) {
      dupGroups += 1;
      dupTotal += n - 1;
      if (dupExamples.length < MAX_ROW_PROBLEMS) dupExamples.push(id);
    }
  });
  if (dupGroups > 0) {
    warnings.push(
      `orders.csv: ${dupTotal} duplicate order_id value(s) across ${dupGroups} id(s)` +
        (dupExamples.length > 0 ? ` (e.g. ${dupExamples.join(", ")})` : "") +
        " — first occurrence counted"
    );
  }
  if (zeroValueOrders > 0) {
    warnings.push(
      `orders.csv: ${zeroValueOrders} order(s) with zero or negative value — counted as-is`
    );
  }
  if (orphanOrders > 0) {
    const pct = t.orders.length > 0 ? (orphanOrders / t.orders.length) * 100 : 0;
    warnings.push(
      `orders.csv: ${orphanOrders} order(s) (${pct.toFixed(1)}%) reference unknown adset_id — skipped` +
        (orphanExamples.length > 0 ? ` (e.g. ${orphanExamples.join(", ")})` : "")
    );
  }
  if (t.ads.length > 0 && countedOrders > 0) {
    const coverage = (linkedOrders / countedOrders) * 100;
    if (coverage < 100 && !hasLinkage) {
      warnings.push(
        "orders.csv has no ad_id column — per-ad profit unavailable; Frame 4 will show its locked state."
      );
    } else if (coverage < 80) {
      warnings.push(
        `orders.csv: ad_id coverage ${coverage.toFixed(0)}% — per-ad profit is partial; ` +
          `${countedOrders - linkedOrders} order(s) excluded from per-ad profit`
      );
    }
  } else if (t.ads.length > 0 && !hasLinkage) {
    warnings.push(
      "orders.csv has no ad_id column — per-ad profit unavailable; Frame 4 will show its locked state."
    );
  }

  const adsets: AdSet[] = t.spend.map((r) => {
    const spend = num(r["spend_egp"]);
    const profit = profitByAdset.get(r["adset_id"]) ?? 0;
    const poas = spend ? profit / spend : 0;
    const e = econByAdset.get(r["adset_id"]) ?? { revenue: 0, cogs: 0, ship: 0, failed: 0 };
    return {
      id: r["adset_id"],
      name: r["adset_name"],
      channel: r["channel"],
      spend_egp: spend,
      platform_roas: num(r["platform_roas"]),
      true_poas: round3(poas),
      gap: round3(num(r["platform_roas"]) - poas),
      profit_egp: round2(profit),
      orders: ordersByAdset.get(r["adset_id"]) ?? 0,
      delivered_share: null,
      economics: {
        revenue_egp: round2(e.revenue),
        cogs_egp: round2(e.cogs),
        ship_egp: round2(e.ship),
        failed_egp: round2(e.failed),
      },
    };
  });

  const ads: Ad[] = t.ads.map((r) => {
    const spend = num(r["spend_egp"]);
    const profit = profitByAd.get(r["ad_id"]);
    const poas = profit !== undefined && spend ? profit / spend : null;
    const ad: Ad = {
      ad_id: r["ad_id"],
      ad_name: r["ad_name"],
      adset_id: r["adset_id"],
      spend_egp: spend,
      platform_roas: num(r["platform_roas"]),
      frequency: num(r["frequency"]),
      ctr_14d_ago: num(r["ctr_14d_ago"]),
      ctr_now: num(r["ctr_now"]),
      profit_egp: profit !== undefined ? round2(profit) : null,
      poas: poas !== null ? round3(poas) : null,
      orders: null,
    };
    if (r["impressions"]) ad.impressions = Math.round(num(r["impressions"]));
    if (r["clicks"]) ad.clicks = Math.round(num(r["clicks"]));
    return ad;
  });

  const daily: DailyRow[] = t.daily.map((r) => ({
    date: r["date"],
    adset_id: r["adset_id"],
    spend_egp: num(r["spend_egp"]),
    platform_roas: num(r["platform_roas"]),
    cpc_egp: num(r["cpc_egp"]),
    ctr_pct: num(r["ctr_pct"]),
    aov_egp: num(r["aov_egp"]),
    failed_delivery_rate_pct: num(r["failed_delivery_rate_pct"]),
  }));

  const funnel: FunnelRow[] = [];
  const badStep = new Capped();
  t.funnel.forEach((r, i) => {
    const step = (r["step"] ?? "").trim().toLowerCase();
    if (!FUNNEL_STEPS.has(step)) {
      badStep.push(`funnel.csv row ${rowOf("funnel", i)}: unknown step '${r["step"]}'`);
      return;
    }
    funnel.push({
      date: r["date"],
      channel: r["channel"],
      step,
      count: Math.round(num(r["count"])),
    });
  });
  badStep.flush(errors, (n) => `funnel.csv: …and ${n} more unknown-step row(s)`);
  if (errors.length > 0) return { data: null, errors, warnings };

  const totalSpend = adsets.reduce((s, a) => s + a.spend_egp, 0);
  const aov =
    deliveredValues.length > 0
      ? deliveredValues.reduce((s, v) => s + v, 0) / deliveredValues.length
      : 0;

  if (totalSpend === 0) {
    warnings.push("spend.csv totals ≈ EGP 0 — ROAS and POAS will read 0 until spend is fixed");
  }
  if (t.funnel.length > 0) {
    const funnelDays = new Set(t.funnel.map((r) => r["date"])).size;
    if (funnelDays < 8) {
      warnings.push(
        `funnel.csv has ${funnelDays} day(s) of data (< 8) — the leak scan stays skipped`
      );
    }
  }
  if (t.daily.length > 0 && t.funnel.length > 0) {
    const dailyDays = new Set(t.daily.map((r) => r["date"]));
    const funnelDays = new Set(t.funnel.map((r) => r["date"]));
    let overlap = false;
    dailyDays.forEach((d) => {
      if (funnelDays.has(d)) overlap = true;
    });
    if (!overlap) {
      warnings.push(
        "daily_adset.csv and funnel.csv date ranges don't overlap — cross-checks compare different windows"
      );
    }
  }

  const data: DemoData = {
    source: "csv",
    brand: {
      name: opts.brand || "Merchant export",
      note: "Merchant CSV export",
      monthly_ad_spend_egp: totalSpend,
      aov_egp: round2(aov),
    },
    assumptions: [
      "A1 Delivered orders count full order value as revenue.",
      "A2 Refused/RTO orders bring zero revenue but paid shipping; RTO also paid return shipping.",
      "A3 Cancelled orders never shipped — excluded entirely.",
      "A4 COGS counted only on delivered orders (refused goods assumed restockable).",
      "A5 Platform ROAS is taken as reported, not re-computed.",
      "A7 Blended true POAS = total profit / total spend; blended platform ROAS = spend-weighted average.",
    ],
    adsets,
    ads,
    daily,
    funnel,
    gaps: gapsJson as GapLibrary,
    hasAds: ads.length > 0,
    hasDaily: daily.length > 0,
    hasFunnel: funnel.length > 0,
    hasAdLinkage: hasLinkage,
  };
  return { data, errors, warnings };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
