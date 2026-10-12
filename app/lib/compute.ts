import type { Ad, AdSet, CsvTables, DailyRow, DemoData, FunnelRow, GapLibrary } from "./types";
import gapsJson from "@/data/gaps.json";

/** Client-side twin of ingest_csvs.py: turns parsed merchant CSVs into the
 *  DemoData contract. POAS math mirrors A1–A5/A7 exactly like the script. */

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
}

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

export function computeFromCsv(
  t: CsvTables,
  opts: { brand: string; cogs: number; ship: number; rship: number }
): ComputeResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (t.spend.length === 0) errors.push("spend.csv is required and has no data rows.");
  if (t.orders.length === 0) errors.push("orders.csv is required and has no data rows.");
  const adsetIds = new Set(t.spend.map((r) => r["adset_id"]));

  const profitByAdset = new Map<string, number>();
  const profitByAd = new Map<string, number>();
  const ordersByAdset = new Map<string, number>();
  const econByAdset = new Map<string, { revenue: number; cogs: number; ship: number; failed: number }>();
  const deliveredValues: number[] = [];
  let hasLinkage = false;

  const econOf = (id: string) => {
    let e = econByAdset.get(id);
    if (!e) {
      e = { revenue: 0, cogs: 0, ship: 0, failed: 0 };
      econByAdset.set(id, e);
    }
    return e;
  };

  for (const o of t.orders) {
    const st = (o["courier_status"] ?? "").trim().toLowerCase();
    if (!STATUSES.has(st)) {
      errors.push(`orders.csv: unknown courier_status '${o["courier_status"]}' (order ${o["order_id"]})`);
      continue;
    }
    if (!adsetIds.has(o["adset_id"])) {
      warnings.push(`orders.csv: order ${o["order_id"]} references unknown adset_id '${o["adset_id"]}' — skipped`);
      continue;
    }
    const p = orderProfit(o, opts);
    if (p === null) continue; // cancelled
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
      profitByAd.set(adId, (profitByAd.get(adId) ?? 0) + p);
    }
  }
  if (errors.length > 0) return { data: null, errors, warnings };

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
  if (t.ads.length > 0 && !hasLinkage) {
    warnings.push("orders.csv has no ad_id column — per-ad profit unavailable; Frame 4 will show its locked state.");
  }

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
  for (const r of t.funnel) {
    const step = (r["step"] ?? "").trim().toLowerCase();
    if (!FUNNEL_STEPS.has(step)) {
      errors.push(`funnel.csv: unknown step '${r["step"]}'`);
      continue;
    }
    funnel.push({ date: r["date"], channel: r["channel"], step, count: Math.round(num(r["count"])) });
  }
  if (errors.length > 0) return { data: null, errors, warnings };

  const totalSpend = adsets.reduce((s, a) => s + a.spend_egp, 0);
  const aov = deliveredValues.length > 0 ? deliveredValues.reduce((s, v) => s + v, 0) / deliveredValues.length : 0;

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
