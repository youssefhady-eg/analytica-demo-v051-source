import type { DemoData } from "./types";
import { computeLeaks, channelLabel, stepLabel, STEPS } from "./funnel";
import { detectRoasDrop } from "./diagnose";
import { fmtEGP, fmtPct } from "./format";

export type CaseKind = "roas-drop" | "funnel-leak" | "money-offender";

export type CaseSource = "detected" | "submitted";

/** Money-offender filter thresholds — the "looks profitable but loses money"
 *  definition. Single source so UI copy (Ask panel) can't drift from logic. */
export const MONEY_MIN_ROAS = 2.5;
export const MONEY_MAX_POAS = 1.0;

export interface CaseItem {
  id: string;
  kind: CaseKind;
  title: string;
  detail: string;
  impactEgp: number | null;
  adsetId: string | null;
  channel: string | null;
  stepIdx: number | null;
  source: CaseSource;
  submittedBy?: string;
  submitterNote?: string;
}

/** The investigation pipeline's case list — every alert is a case to work.
 *  Ranked by EGP impact; calm states when nothing qualifies. */
export function buildCases(data: DemoData): CaseItem[] {
  const cases: CaseItem[] = [];

  for (const l of computeLeaks(data.funnel, data.brand.aov_egp).filter((x) => x.egpImpact > 0)) {
    cases.push({
      id: `leak-${l.channel}-${l.stepIdx}`,
      kind: "funnel-leak",
      title: `${channelLabel(l.channel)} ${stepLabel(l.stepIdx - 1)} → ${stepLabel(l.stepIdx)} leak`,
      detail: `${fmtPct(l.rateThen * 100)} → ${fmtPct(l.rateNow * 100)} — ≈${fmtEGP(l.egpImpact)}/mo left on the table`,
      impactEgp: Math.round(l.egpImpact),
      adsetId: null,
      channel: l.channel,
      stepIdx: l.stepIdx,
      source: "detected",
    });
  }

  for (const a of data.adsets
    .filter((x) => x.platform_roas >= MONEY_MIN_ROAS && x.true_poas < MONEY_MAX_POAS)
    .sort((x, y) => y.spend_egp - x.spend_egp)) {
    const submitted = data.source === "sample" && /tiktok.*prospecting/i.test(a.name);
    cases.push({
      id: `money-${a.id}`,
      kind: "money-offender",
      title: `${a.name} looks profitable, loses money`,
      detail: `Platform ${a.platform_roas.toFixed(2)}× vs true ${a.true_poas.toFixed(2)}× — ${fmtEGP(a.spend_egp)}/mo spend`,
      impactEgp: Math.round(a.spend_egp),
      adsetId: a.id,
      channel: null,
      stepIdx: null,
      source: submitted ? "submitted" : "detected",
      ...(submitted
        ? {
            submittedBy: "Sara · performance marketer",
            submitterNote:
              "Dashboard says 3.8× but finance says we're bleeding. What's the real number?",
          }
        : {}),
    });
  }

  const rc = detectRoasDrop(data);
  if (rc) {
    const submitted = data.source === "sample" && /broad/i.test(rc.adset.name);
    cases.push({
      id: `drop-${rc.adset.id}`,
      kind: "roas-drop",
      title: `${rc.adset.name}: ROAS −${rc.dropPct.toFixed(0)}%`,
      detail: `Sharpest decline in the daily scan — media metrics flat, damage is post-click`,
      impactEgp: null,
      adsetId: rc.adset.id,
      channel: null,
      stepIdx: null,
      source: submitted ? "submitted" : "detected",
      ...(submitted
        ? {
            submittedBy: "Ahmed · performance marketer",
            submitterNote: "ROAS fell 14% on Broad this week — is it the creative or the audience?",
          }
        : {}),
    });
  }

  // P1-10: unsized (roas-drop) cases sort last; ties break by severity.
  const dropSeverity: Record<string, number> = {};
  if (rc) dropSeverity[`drop-${rc.adset.id}`] = rc.dropPct;

  return cases.sort(
    (a, b) =>
      (b.impactEgp ?? 0) - (a.impactEgp ?? 0) ||
      (dropSeverity[b.id] ?? 0) - (dropSeverity[a.id] ?? 0)
  );
}

export function getCase(data: DemoData, id: string | null): CaseItem | null {
  if (!id) return null;
  return buildCases(data).find((c) => c.id === id) ?? null;
}

/** P1-01: one source for "what still needs attention". A case is waiting
 *  unless it is on the watchlist or carries a disposition. A snoozed case
 *  whose metric worsened (P2) is back — it waits again. */
export type DispositionKind = "resolved" | "snoozed" | "override";
export interface DispositionStatus {
  kind: DispositionKind;
  resurfaced?: boolean;
}

export function waitingCases(
  data: DemoData,
  watchlist: string[],
  dispositions: Record<string, DispositionStatus> = {}
): CaseItem[] {
  const watched = new Set(watchlist);
  return buildCases(data).filter((c) => {
    if (watched.has(c.id)) return false;
    const d = dispositions[c.id];
    if (!d) return true;
    return d.kind === "snoozed" && d.resurfaced === true;
  });
}

/** P2 §7.3: relative tolerance for "the numbers got worse". */
export const WORSEN_TOLERANCE = 0.02;

/** The case's tracked metric at snooze time — the baseline re-surfacing
 *  compares against. Null when the metric was unavailable (never re-surfaces). */
export interface WorseningSnapshot {
  kind: CaseKind;
  value: number | null;
}

/** P2 §7.3: the single tracked metric per kind. `factor` is the demo-only
 *  simulated-worsening overlay (multiplied in, never mutates data). */
export function worseningMetric(c: CaseItem, data: DemoData, factor = 1): number | null {
  if (c.kind === "funnel-leak" && c.channel && c.stepIdx !== null) {
    const leak = computeLeaks(data.funnel, data.brand.aov_egp).find(
      (l) => l.channel === c.channel && l.stepIdx === c.stepIdx
    );
    return leak && leak.egpImpact > 0 ? leak.egpImpact * factor : null;
  }
  if (c.kind === "money-offender" && c.adsetId) {
    const a = data.adsets.find((x) => x.id === c.adsetId);
    return a ? a.true_poas * factor : null;
  }
  if (c.kind === "roas-drop" && c.adsetId) {
    const rc = detectRoasDrop(data);
    return rc && rc.adset.id === c.adsetId ? rc.dropPct * factor : null;
  }
  return null;
}

const LOWER_WORSE: ReadonlySet<CaseKind> = new Set<CaseKind>(["money-offender"]);

/** P2 §7.3: worse than the snapshot by more than WORSEN_TOLERANCE (relative).
 *  Direction comes from the snapshot's kind (POAS lower = worse, the rest
 *  higher = worse). Missing metrics never count as worsened. */
export function isWorsened(snapshot: WorseningSnapshot, current: number | null): boolean {
  const base = snapshot.value;
  if (base == null || current == null || base === 0) return false;
  const rel = LOWER_WORSE.has(snapshot.kind)
    ? (base - current) / Math.abs(base)
    : (current - base) / Math.abs(base);
  return rel > WORSEN_TOLERANCE;
}

/** Figure for "the metric at snooze time" on the handled log — computed. */
export function snapshotLabel(s: WorseningSnapshot): string {
  if (s.value == null) return "—";
  if (s.kind === "money-offender") return `${s.value.toFixed(2)}×`;
  if (s.kind === "roas-drop") return `−${s.value.toFixed(0)}%`;
  return `${fmtEGP(Math.round(s.value))}/mo`;
}

export type DetectorRun = { status: "ran" | "skipped"; reason: string | null };
export interface DetectorStatus {
  roasDrop: DetectorRun;
  funnel: DetectorRun;
  adLinkage: DetectorRun;
}

/** P1-02: which detectors actually ran on this dataset — and why not.
 *  Detect must never claim "all quiet" for a check that didn't run. */
export function detectorStatus(data: DemoData): DetectorStatus {
  const roasDrop: DetectorRun = !data.hasDaily
    ? { status: "skipped", reason: "daily_adset.csv not loaded" }
    : data.daily.some((r) => data.daily.filter((x) => x.adset_id === r.adset_id).length >= 8)
      ? { status: "ran", reason: null }
      : { status: "skipped", reason: "daily_adset.csv has < 8 days" };
  const funnelDates = new Set(data.funnel.map((r) => r.date)).size;
  const funnel: DetectorRun = !data.hasFunnel
    ? { status: "skipped", reason: "funnel.csv not loaded" }
    : funnelDates >= 8
      ? { status: "ran", reason: null }
      : { status: "skipped", reason: "funnel.csv has < 8 days" };
  const adLinkage: DetectorRun = data.hasAdLinkage
    ? { status: "ran", reason: null }
    : !data.hasAds
      ? { status: "skipped", reason: "ads.csv not loaded" }
      : { status: "skipped", reason: "orders.csv has no ad_id column" };
  return { roasDrop, funnel, adLinkage };
}

/** Evidence layers for the Diagnose stage — each layer rules something out. */
export interface EvidenceLayer {
  title: string;
  verdict: "ok" | "bad";
  text: string;
}

export function evidenceLayers(c: CaseItem, data: DemoData): EvidenceLayer[] {
  if (c.kind === "roas-drop") {
    const rc = detectRoasDrop(data);
    if (!rc) return [];
    return [
      {
        title: "Layer 1 — Are you overpaying for clicks?",
        verdict: "ok",
        text: `CPC ${fmtEGP(rc.cpcThen)} → ${fmtEGP(rc.cpcNow)}. Essentially flat — the auction isn't the problem.`,
      },
      {
        title: "Layer 2 — Do the ads still pull?",
        verdict: "ok",
        text: `CTR ${fmtPct(rc.ctrThen)} → ${fmtPct(rc.ctrNow)}. The creative hook is fine.`,
      },
      {
        title: "Layer 3 — What happens after the click?",
        verdict: "bad",
        text: `AOV ${fmtEGP(rc.first.aov_egp)} → ${fmtEGP(rc.last.aov_egp)} (${fmtPct(rc.aovChangePct)}). Baskets shrank.`,
      },
      {
        title: "Layer 4 — Do orders turn into cash?",
        verdict: "bad",
        text: `Failed deliveries ${fmtPct(rc.failThen)} → ${fmtPct(rc.failNow)} — nearly doubled. The leak is post-click.`,
      },
    ];
  }
  if (c.kind === "funnel-leak" && c.channel && c.stepIdx !== null) {
    const from = stepLabel(c.stepIdx - 1);
    const to = stepLabel(c.stepIdx);
    return [
      {
        title: `Layer 1 — Is traffic the problem?`,
        verdict: "ok",
        text: `Sessions held steady on ${channelLabel(c.channel)}. Buyers arrive — they stall at ${to.toLowerCase()}.`,
      },
      {
        title: `Layer 2 — Where exactly?`,
        verdict: "bad",
        text: `${from} → ${to} is the only transition deteriorating. The rest of the funnel is healthy.`,
      },
    ];
  }
  if (c.kind === "money-offender" && c.adsetId) {
    const a = data.adsets.find((x) => x.id === c.adsetId);
    if (!a) return [];
    const e = a.economics;
    const total = e.revenue_egp || 1;
    return [
      {
        title: "Layer 1 — What the platform sees",
        verdict: "ok",
        text: `Platform ROAS ${a.platform_roas.toFixed(2)}× on ${fmtEGP(a.spend_egp)} spend. Looks healthy — the platform stops here.`,
      },
      {
        title: "Layer 2 — What it costs to fulfill",
        verdict: "bad",
        text: `COGS ${fmtEGP(e.cogs_egp)} (${fmtPct((e.cogs_egp / total) * 100)} of revenue) + shipping ${fmtEGP(e.ship_egp)}.`,
      },
      {
        title: "Layer 3 — What failed deliveries burn",
        verdict: "bad",
        text: `${fmtEGP(e.failed_egp)} burned on refused/RTO shipping. True POAS: ${a.true_poas.toFixed(2)}× — below 1. Every pound of spend loses money.`,
      },
    ];
  }
  return [];
}

export interface PlanStep {
  title: string;
  detail: string;
  when: string;
}

/** Sequenced action plan — what to do first, second, third. */
export function casePlan(c: CaseItem, data: DemoData): PlanStep[] {
  if (c.kind === "roas-drop") {
    const rc = detectRoasDrop(data);
    const name = rc?.culprit ? rc.culprit.ad_name : "the culprit creative";
    const budget = rc?.culprit ? `${fmtEGP(rc.culprit.spend_egp)}/mo` : "its budget";
    return [
      {
        title: "Pause the bleeder",
        detail: `Pause ${name} today — it drags the whole ad set.`,
        when: "today",
      },
      {
        title: "Move the budget",
        detail: `Shift ${budget} to the ad set's top-profit creatives.`,
        when: "this week",
      },
      {
        title: "Watch the baskets",
        detail: "Track AOV and failed-delivery rate for 7 days — the damage is post-click.",
        when: "7 days",
      },
    ];
  }
  if (c.kind === "funnel-leak" && c.channel && c.stepIdx !== null) {
    const to = stepLabel(c.stepIdx);
    const from = stepLabel(c.stepIdx - 1);
    return [
      {
        title: "Recover the volume now",
        detail: `Retargeting + WhatsApp nudge on the abandoned ${to.toLowerCase()} volume.`,
        when: "48h",
      },
      {
        title: "Fix the cause",
        detail: "Take the checklist's top cause — trust signals and friction at the finish line.",
        when: "this week",
      },
      {
        title: "Re-measure",
        detail: `Confirm the ${from} → ${to} rate recovers before scaling spend.`,
        when: "7 days",
      },
    ];
  }
  const a = data.adsets.find((x) => x.id === c.adsetId);
  if (a) {
    const total = a.economics.revenue_egp || 1;
    return [
      {
        title: "Stop the bleed",
        detail: `Cut ${a.name}'s ${fmtEGP(a.spend_egp)}/mo to zero — every pound loses money.`,
        when: "today",
      },
      {
        title: "Fix the margin",
        detail: `COGS is ${fmtPct((a.economics.cogs_egp / total) * 100)} of revenue and failed deliveries burn ${fmtEGP(a.economics.failed_egp)}. Fix before spending again.`,
        when: "this week",
      },
      {
        title: "Re-enter gated",
        detail: "Resume spend only when true POAS holds above 1.2×.",
        when: "gated",
      },
    ];
  }
  return [
    { title: "Pause spend", detail: "Pause spend until the margin is fixed.", when: "today" },
  ];
}

export { STEPS };
