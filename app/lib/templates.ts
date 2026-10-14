import type { DemoData } from "./types";
import { OPTIONAL_COLS, REQUIRED_COLS } from "./csv";

/**
 * Phase 6 (P6-07) — downloadable CSVs, generated from data (never hand-typed).
 * Templates carry correct headers (reused from the parser contract) plus 3
 * sample rows each; the full sample export round-trips the whole dataset.
 */

export type CsvFileKey = "spend" | "orders" | "ads" | "daily" | "funnel";

export const TEMPLATE_FILES: { key: CsvFileKey; label: string }[] = [
  { key: "spend", label: "spend.csv" },
  { key: "orders", label: "orders.csv" },
  { key: "ads", label: "ads.csv" },
  { key: "daily", label: "daily_adset.csv" },
  { key: "funnel", label: "funnel.csv" },
];

function headersFor(key: CsvFileKey): string[] {
  const base = key === "spend" || key === "orders" ? REQUIRED_COLS[key] : OPTIONAL_COLS[key];
  const extras: Record<string, string[]> = {
    spend: [],
    orders: ["cogs_egp", "shipping_cost_egp", "return_shipping_egp", "ad_id"],
    ads: ["impressions", "clicks"],
    daily: [],
    funnel: [],
  };
  return [...base, ...extras[key]];
}

function esc(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n") + "\n";
}

/** Template contents: correct headers + 3 sample rows each from live data. */
export function buildTemplateCsvs(data: DemoData): Record<CsvFileKey, string> {
  const spendRows = data.adsets.slice(0, 3).map((a) => ({
    adset_id: a.id,
    adset_name: a.name,
    channel: a.channel,
    spend_egp: a.spend_egp,
    platform_roas: a.platform_roas,
  }));
  const firstAdsets = data.adsets.slice(0, 3);
  const ordersRows = [
    {
      order_id: "TPL-001",
      adset_id: firstAdsets[0]?.id ?? "adset-1",
      order_value_egp: data.brand.aov_egp,
      cogs_egp: "",
      shipping_cost_egp: "",
      return_shipping_egp: "",
      courier_status: "delivered",
      ad_id: "",
    },
    {
      order_id: "TPL-002",
      adset_id: firstAdsets[1]?.id ?? "adset-1",
      order_value_egp: data.brand.aov_egp,
      cogs_egp: "",
      shipping_cost_egp: "",
      return_shipping_egp: "",
      courier_status: "refused",
      ad_id: "",
    },
    {
      order_id: "TPL-003",
      adset_id: firstAdsets[0]?.id ?? "adset-1",
      order_value_egp: data.brand.aov_egp,
      cogs_egp: "",
      shipping_cost_egp: "",
      return_shipping_egp: "",
      courier_status: "delivered",
      ad_id: "",
    },
  ];
  const adsRows = data.ads.slice(0, 3).map((a) => ({
    ad_id: a.ad_id,
    ad_name: a.ad_name,
    adset_id: a.adset_id,
    spend_egp: a.spend_egp,
    platform_roas: a.platform_roas,
    frequency: a.frequency,
    ctr_14d_ago: a.ctr_14d_ago,
    ctr_now: a.ctr_now,
    impressions: a.impressions ?? "",
    clicks: a.clicks ?? "",
  }));
  const dailyRows = data.daily.slice(0, 3).map((r) => ({
    date: r.date,
    adset_id: r.adset_id,
    spend_egp: r.spend_egp,
    platform_roas: r.platform_roas,
    cpc_egp: r.cpc_egp,
    ctr_pct: r.ctr_pct,
    aov_egp: r.aov_egp,
    failed_delivery_rate_pct: r.failed_delivery_rate_pct,
  }));
  const funnelRows = data.funnel.slice(0, 3).map((r) => ({
    date: r.date,
    channel: r.channel,
    step: r.step,
    count: r.count,
  }));
  const byKey: Record<CsvFileKey, Record<string, unknown>[]> = {
    spend: spendRows,
    orders: ordersRows,
    ads: adsRows,
    daily: dailyRows,
    funnel: funnelRows,
  };
  const out = {} as Record<CsvFileKey, string>;
  for (const { key } of TEMPLATE_FILES) out[key] = toCsv(headersFor(key), byKey[key]);
  return out;
}

/**
 * Full sample export. Orders are synthesized per (adset, ad) from economics
 * so profit reconciles EXACTLY: one delivered order per ad carrying its share
 * of revenue/COGS/shipping, plus one refused order per adset carrying the
 * failed-delivery burn as shipping. Headlines round-trip exactly; AOV (a
 * mean of delivered values) legitimately differs from the engineered 850.
 */
export function buildSampleCsvs(data: DemoData): Record<CsvFileKey, string> {
  const spendRows = data.adsets.map((a) => ({
    adset_id: a.id,
    adset_name: a.name,
    channel: a.channel,
    spend_egp: a.spend_egp,
    platform_roas: a.platform_roas,
  }));
  const ordersRows: Record<string, unknown>[] = [];
  let n = 0;
  const adsByAdset = new Map<string, typeof data.ads>();
  for (const a of data.ads) {
    const list = adsByAdset.get(a.adset_id) ?? [];
    list.push(a);
    adsByAdset.set(a.adset_id, list);
  }
  for (const a of data.adsets) {
    const e = a.economics;
    const ads = adsByAdset.get(a.id) ?? [];
    const parts = Math.max(1, ads.length);
    const pushDelivered = (value: number, cogs: number, ship: number, adId: string) => {
      n += 1;
      ordersRows.push({
        order_id: `S-${String(n).padStart(5, "0")}`,
        adset_id: a.id,
        order_value_egp: value,
        cogs_egp: cogs,
        shipping_cost_egp: ship,
        return_shipping_egp: "",
        courier_status: "delivered",
        ad_id: adId,
      });
    };
    if (ads.length === 0) {
      pushDelivered(e.revenue_egp, e.cogs_egp, e.ship_egp, "");
    } else {
      ads.forEach((ad) => {
        pushDelivered(e.revenue_egp / parts, e.cogs_egp / parts, e.ship_egp / parts, ad.ad_id);
      });
    }
    if (e.failed_egp > 0) {
      n += 1;
      ordersRows.push({
        order_id: `S-${String(n).padStart(5, "0")}`,
        adset_id: a.id,
        order_value_egp: e.revenue_egp / parts,
        cogs_egp: "",
        shipping_cost_egp: e.failed_egp,
        return_shipping_egp: "",
        courier_status: "refused",
        ad_id: "",
      });
    }
  }
  const adsRows = data.ads.map((a) => ({
    ad_id: a.ad_id,
    ad_name: a.ad_name,
    adset_id: a.adset_id,
    spend_egp: a.spend_egp,
    platform_roas: a.platform_roas,
    frequency: a.frequency,
    ctr_14d_ago: a.ctr_14d_ago,
    ctr_now: a.ctr_now,
    impressions: a.impressions ?? "",
    clicks: a.clicks ?? "",
  }));
  const dailyRows = data.daily.map((r) => ({
    date: r.date,
    adset_id: r.adset_id,
    spend_egp: r.spend_egp,
    platform_roas: r.platform_roas,
    cpc_egp: r.cpc_egp,
    ctr_pct: r.ctr_pct,
    aov_egp: r.aov_egp,
    failed_delivery_rate_pct: r.failed_delivery_rate_pct,
  }));
  const funnelRows = data.funnel.map((r) => ({
    date: r.date,
    channel: r.channel,
    step: r.step,
    count: r.count,
  }));
  const byKey: Record<CsvFileKey, Record<string, unknown>[]> = {
    spend: spendRows,
    orders: ordersRows,
    ads: adsRows,
    daily: dailyRows,
    funnel: funnelRows,
  };
  const out = {} as Record<CsvFileKey, string>;
  for (const { key } of TEMPLATE_FILES) out[key] = toCsv(headersFor(key), byKey[key]);
  return out;
}

/** Blob + <a download> — works from file:// inside a click handler. */
export function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
