/** Shared data-model types for the Analytica demo.
 *  Both producers (generate_data.py / ingest_csvs.py / in-browser CSV ingest)
 *  target this contract; all frames consume it via useDemoData(). */

export interface AdSetEconomics {
  revenue_egp: number; // delivered order values
  cogs_egp: number; // COGS on delivered orders
  ship_egp: number; // shipping paid on delivered orders
  failed_egp: number; // shipping (+return) burned on refused/RTO orders
}

export interface AdSet {
  id: string;
  name: string;
  channel: string;
  spend_egp: number;
  platform_roas: number;
  true_poas: number;
  gap: number;
  profit_egp: number;
  orders: number;
  delivered_share: number | null;
  economics: AdSetEconomics;
}

export interface Ad {
  ad_id: string;
  ad_name: string;
  adset_id: string;
  spend_egp: number;
  impressions?: number;
  clicks?: number;
  platform_roas: number;
  frequency: number;
  ctr_14d_ago: number;
  ctr_now: number;
  cpr_trend?: number[];
  /** null when orders lack ad_id linkage — Frame 4 shows its locked state. */
  profit_egp: number | null;
  poas: number | null;
  orders: number | null;
}

export interface DailyRow {
  date: string;
  adset_id: string;
  spend_egp: number;
  platform_roas: number;
  cpc_egp: number;
  ctr_pct: number;
  aov_egp: number;
  failed_delivery_rate_pct: number;
}

export interface FunnelRow {
  date: string;
  channel: string;
  step: string;
  count: number;
}

export interface GapItem {
  gap: string;
  detail: string;
  source: "data" | "inspection" | "input";
}

export interface GapStage {
  label: string;
  likely_meaning: string;
  checklist: GapItem[];
  recover: string;
  fix_cause: string;
}

export interface GapLibrary {
  version: number;
  stages: Record<string, GapStage>;
}

export interface DemoData {
  source: "sample" | "csv";
  brand: { name: string; note: string; monthly_ad_spend_egp: number; aov_egp: number };
  assumptions: string[];
  adsets: AdSet[];
  ads: Ad[];
  daily: DailyRow[];
  funnel: FunnelRow[];
  gaps: GapLibrary;
  hasAds: boolean;
  hasDaily: boolean;
  hasFunnel: boolean;
  hasAdLinkage: boolean;
}

/** Parsed CSV tables, keyed by file. */
export interface CsvTables {
  spend: Record<string, string>[];
  orders: Record<string, string>[];
  ads: Record<string, string>[];
  daily: Record<string, string>[];
  funnel: Record<string, string>[];
}
