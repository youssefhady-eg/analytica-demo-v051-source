import type { FunnelRow } from "./types";

export const STEPS = ["session", "add_to_cart", "checkout", "purchase"] as const;
export const STEP_LABELS: Record<string, string> = {
  session: "Sessions",
  add_to_cart: "Add to cart",
  checkout: "Checkout",
  purchase: "Purchase",
};
/** Gap-library stage keys per leaking transition. */
export const STAGE_KEY: Record<string, string> = {
  "session>add_to_cart": "session_to_add_to_cart",
  "add_to_cart>checkout": "add_to_cart_to_checkout",
  "checkout>purchase": "checkout_to_purchase",
};

/** Safe step label — avoids number-into-string-keyed-record bugs. */
export function stepLabel(idx: number): string {
  const key = STEPS[idx];
  return key ? STEP_LABELS[key] : "?";
}

export interface Leak {
  channel: string;
  /** index into STEPS of the leaking step (1..3); the transition is STEPS[i-1] -> STEPS[i] */
  stepIdx: number;
  rateThen: number;
  rateNow: number;
  lostPurchases: number;
  egpImpact: number;
}

/** Leak detection (real logic): per channel, the step whose conversion
 *  deteriorated most (first-7d baseline vs last-3d current). Lost shoppers at
 *  the leaking step propagate through downstream baseline rates to expected
 *  lost purchases, projected monthly; EGP impact = lost purchases × AOV. */
export function computeLeaks(funnel: FunnelRow[], aov: number): Leak[] {
  const channels = Array.from(new Set(funnel.map((r) => r.channel)));
  return channels.map((channel) => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const r of funnel) {
      if (r.channel !== channel) continue;
      (byDate[r.date] ??= {})[r.step] = r.count;
    }
    const dates = Object.keys(byDate).sort();
    if (dates.length < 8) {
      return { channel, stepIdx: 3, rateThen: 0, rateNow: 0, lostPurchases: 0, egpImpact: 0 };
    }
    const first7 = dates.slice(0, 7);
    const last7 = dates.slice(7);
    const last3 = dates.slice(-3);
    const avg = (ds: string[], step: string) =>
      ds.reduce((s, d) => s + (byDate[d][step] ?? 0), 0) / ds.length;
    const baseRate: number[] = [];
    const curRate: number[] = [];
    for (let s = 1; s < STEPS.length; s++) {
      baseRate.push(avg(first7, STEPS[s]) / Math.max(1, avg(first7, STEPS[s - 1])));
      curRate.push(avg(last3, STEPS[s]) / Math.max(1, avg(last3, STEPS[s - 1])));
    }
    let wi = 0;
    for (let s = 1; s < baseRate.length; s++) {
      if (baseRate[s] - curRate[s] > baseRate[wi] - curRate[wi]) wi = s;
    }
    const stepIdx = wi + 1;
    const volPrev = avg(last7, STEPS[stepIdx - 1]);
    const lostAtStepPerDay = volPrev * Math.max(0, baseRate[wi] - curRate[wi]);
    let downstream = 1;
    for (let j = stepIdx; j < STEPS.length - 1; j++) downstream *= baseRate[j];
    const monthlyLost = lostAtStepPerDay * downstream * 30;
    return {
      channel,
      stepIdx,
      rateThen: baseRate[wi],
      rateNow: curRate[wi],
      lostPurchases: Math.round(monthlyLost),
      egpImpact: Math.round(monthlyLost * aov),
    };
  });
}

export const CHANNEL_LABEL: Record<string, string> = { meta: "Meta", tiktok: "TikTok" };
export const channelLabel = (c: string) =>
  CHANNEL_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
