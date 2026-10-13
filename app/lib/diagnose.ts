import type { AdSet, DailyRow, DemoData } from "./types";
import { adFlags, heroCutoff, type AdFlag, type LinkedAd } from "./metrics";
import { fmtPct } from "./format";

/**
 * Level 1 "smarts" — deterministic, runs on any dataset (sample or merchant
 * CSV). Every string here is GENERATED from the data (rules), never
 * hand-written per story. Marked RULES (not MOCK, not the AI Analyst).
 */

export interface RoasCase {
  adset: AdSet;
  dropPct: number;
  first: DailyRow;
  last: DailyRow;
  cpcThen: number;
  cpcNow: number;
  ctrThen: number;
  ctrNow: number;
  aovChangePct: number;
  failThen: number;
  failNow: number;
  culprit: LinkedAd | null;
  culpritFlags: AdFlag[];
}

const avg = (rows: DailyRow[], k: keyof DailyRow): number =>
  rows.reduce((s, r) => s + (r[k] as number), 0) / Math.max(1, rows.length);

/** ROAS-drop trigger — first-half vs second-half decline at or above this
 *  percent. Single source so UI copy can't drift from logic. */
export const ROAS_DROP_MIN_PCT = 10;

/** RULES: scan daily series for the sharpest ROAS decline. Null when nothing
 *  dropped ≥10% — the frame then shows its honest empty state. */
export function detectRoasDrop(data: DemoData): RoasCase | null {
  if (!data.hasDaily) return null;
  let best: RoasCase | null = null;
  for (const adset of data.adsets) {
    const rows = data.daily
      .filter((r) => r.adset_id === adset.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length < 8) continue;
    const half = Math.floor(rows.length / 2);
    const firstH = rows.slice(0, half);
    const lastH = rows.slice(-half);
    const rThen = avg(firstH, "platform_roas");
    const rNow = avg(lastH, "platform_roas");
    if (rThen <= 0) continue;
    const dropPct = (1 - rNow / rThen) * 100;
    if (dropPct >= ROAS_DROP_MIN_PCT && (!best || dropPct > best.dropPct)) {
      const adList = data.ads.filter(
        (a): a is LinkedAd => a.adset_id === adset.id && a.poas !== null && a.profit_egp !== null
      );
      let culprit: LinkedAd | null = null;
      let culpritFlags: AdFlag[] = [];
      if (adList.length > 0) {
        const cutoff = heroCutoff(adList);
        const scored = adList
          .map((a) => ({ a, flags: adFlags(a, cutoff) }))
          .filter((x) => x.flags.includes("ZOMBIE") || x.flags.includes("FATIGUING"))
          .sort((x, y) => x.a.poas - y.a.poas);
        if (scored.length > 0) {
          culprit = scored[0].a;
          culpritFlags = scored[0].flags;
        }
      }
      const first = rows[0];
      const last = rows[rows.length - 1];
      best = {
        adset,
        dropPct,
        first,
        last,
        cpcThen: avg(firstH, "cpc_egp"),
        cpcNow: avg(lastH, "cpc_egp"),
        ctrThen: avg(firstH, "ctr_pct"),
        ctrNow: avg(lastH, "ctr_pct"),
        aovChangePct: ((last.aov_egp - first.aov_egp) / Math.max(1, first.aov_egp)) * 100,
        failThen: first.failed_delivery_rate_pct,
        failNow: last.failed_delivery_rate_pct,
        culprit,
        culpritFlags,
      };
    }
  }
  return best;
}
