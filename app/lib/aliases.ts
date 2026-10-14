/**
 * Phase 6 (P6-03) — header aliases for real merchant exports. One map of
 * canonical column → accepted header spellings (generic aliases only: Excel
 * / Ads Manager / Shopify-style names). Matching is case/space/underscore
 * insensitive. Applied per file in lib/csv.ts, which reports every applied
 * alias in the file's info line.
 */

// TODO(real-export): extend from real Vondera exports — the owner will
// supply real files; add their exact headers here once seen.
export const HEADER_ALIASES: Record<string, string[]> = {
  adset_id: ["adset_id", "adsetid", "ad_set", "adset", "ad_set_id", "campaign_id"],
  adset_name: ["adset_name", "adsetname", "ad_set_name", "adset", "campaign", "campaign_name"],
  channel: ["channel", "platform", "media_source", "source", "network"],
  spend_egp: [
    "spend_egp",
    "spend",
    "cost",
    "amount_spent",
    "ad_spend",
    "media_cost",
    "media_spend",
  ],
  platform_roas: ["platform_roas", "roas", "platformroas"],
  order_id: ["order_id", "orderid", "order", "order_number", "order_no"],
  order_value_egp: [
    "order_value_egp",
    "order_value",
    "ordervalue",
    "value",
    "revenue",
    "total",
    "grand_total",
    "amount",
  ],
  courier_status: [
    "courier_status",
    "status",
    "delivery_status",
    "shipping_status",
    "fulfillment_status",
  ],
  cogs_egp: ["cogs_egp", "cogs", "cost_of_goods", "product_cost"],
  shipping_cost_egp: [
    "shipping_cost_egp",
    "shipping_cost",
    "shipping",
    "delivery_fee",
    "shipping_fee",
  ],
  return_shipping_egp: ["return_shipping_egp", "return_shipping", "return_cost", "rto_cost"],
  ad_id: ["ad_id", "adid", "ad", "creative_id", "creative"],
  ad_name: ["ad_name", "adname", "ad", "creative", "creative_name"],
  frequency: ["frequency", "freq", "avg_frequency"],
  ctr_14d_ago: ["ctr_14d_ago", "ctr_before", "ctr_then", "ctr_14d"],
  ctr_now: ["ctr_now", "ctr", "ctr_current"],
  impressions: ["impressions", "impr", "views"],
  clicks: ["clicks", "link_clicks"],
  date: ["date", "day", "dt"],
  cpc_egp: ["cpc_egp", "cpc", "cost_per_click"],
  ctr_pct: ["ctr_pct", "ctr_percent", "ctr"],
  aov_egp: ["aov_egp", "aov", "avg_order_value"],
  failed_delivery_rate_pct: [
    "failed_delivery_rate_pct",
    "failed_delivery_rate",
    "failed_rate",
    "rto_rate",
  ],
  step: ["step", "stage", "event", "funnel_step"],
  count: ["count", "users", "total", "volume", "sessions"],
};

/** Lowercase, strip spaces/underscores/hyphens — the P6-03 matching rule. */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
}

const aliasIndex: Record<string, string[]> = (() => {
  const idx: Record<string, string[]> = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const a of aliases) {
      const key = normalizeHeader(a);
      idx[key] ??= [];
      if (!idx[key].includes(canonical)) idx[key].push(canonical);
    }
  }
  return idx;
})();

/**
 * Map a raw header to its canonical column, or null when unknown. When a
 * generic name fits several columns ("ctr"), `preferred` (the file's own
 * expected columns) picks the file's meaning.
 */
export function canonicalHeader(raw: string, preferred: string[] = []): string | null {
  const cands = aliasIndex[normalizeHeader(raw)] ?? [];
  if (cands.length === 0) return null;
  return cands.find((c) => preferred.includes(c)) ?? cands[0];
}
