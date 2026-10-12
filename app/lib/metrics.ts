import type { Ad } from "./types";

/** Creative flags — computed with real logic, not mocked.
 *  Callers must narrow to ads with computed profit (poas/profit_egp non-null),
 *  i.e. after the linkage gate. */
export type AdFlag = "FATIGUING" | "ZOMBIE" | "HERO";

/** An ad with computed profit — i.e. past the linkage gate. */
export type LinkedAd = Ad & { poas: number; profit_egp: number };

export function adFlags(ad: LinkedAd, heroCutoff: number): AdFlag[] {
  const flags: AdFlag[] = [];
  if (ad.ctr_now < 0.6 * ad.ctr_14d_ago && ad.frequency >= 3.5) flags.push("FATIGUING");
  if (ad.poas < 1.0 && ad.spend_egp >= 2000) flags.push("ZOMBIE");
  if (ad.poas >= heroCutoff) flags.push("HERO");
  return flags;
}

/** Top-quartile POAS cutoff within an ad set (for HERO flags). */
export function heroCutoff(adList: LinkedAd[]): number {
  const sorted = [...adList].sort((a, b) => b.poas - a.poas);
  const idx = Math.max(0, Math.ceil(sorted.length / 4) - 1);
  return sorted[idx]?.poas ?? Infinity;
}

/** "X of Y creatives drive Z% of the profit" — computed concentration line. */
export function profitConcentration(adList: LinkedAd[]): { n: number; y: number; pct: number } {
  const total = adList.reduce((s, a) => s + a.profit_egp, 0);
  const sorted = [...adList].sort((a, b) => b.profit_egp - a.profit_egp);
  let cum = 0;
  let n = 0;
  for (const a of sorted) {
    cum += a.profit_egp;
    n += 1;
    if (cum >= 0.8 * total) break;
  }
  return { n, y: adList.length, pct: total > 0 ? (cum / total) * 100 : 0 };
}
