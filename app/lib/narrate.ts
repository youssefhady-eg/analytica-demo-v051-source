import type { CaseItem, CaseKind } from "./cases";
import type { DemoData } from "./types";
import { detectRoasDrop } from "./diagnose";
import { evidenceLayers } from "./cases";
import { channelLabel, stepLabel } from "./funnel";
import { fmtEGP, fmtPct, fmtX } from "./format";

export type Stage = "detect" | "isolate" | "diagnose" | "decide" | "verify";

/** Deterministic (Level 1) narration: the Analyst's voice at each pipeline
 *  stage, generated from computed data. The live toggle re-verbalizes it. */

export interface NarrateOpts {
  /** Decide stage: the plan was approved — don't invite approval again. */
  approved?: boolean;
  /** Decide stage: the marketer overrode this read — acknowledge their call. */
  override?: boolean;
  /** Diagnose stage: how many evidence layers are currently revealed. */
  revealed?: number;
  /** Diagnose stage: total evidence layers for this case. */
  totalLayers?: number;
}

export function narrate(stage: Stage, c: CaseItem, data: DemoData, opts: NarrateOpts = {}): string {
  const adset = data.adsets.find((a) => a.id === c.adsetId);
  switch (stage) {
    case "detect":
      return detectNote(c);
    case "isolate":
      return isolateNote(c, data);
    case "diagnose":
      return diagnoseNote(c, data, opts);
    case "decide":
      return decideNote(c, data, opts);
    case "verify":
      return verifyNote(c, adset?.name ?? c.title);
  }
}

function detectNote(c: CaseItem): string {
  const money = c.impactEgp !== null ? ` Worth about ${fmtEGP(c.impactEgp)}/mo.` : "";
  return `This one moved enough to matter.${money} Open it and I'll walk you through what I see.`;
}

function isolateNote(c: CaseItem, data: DemoData): string {
  if (c.kind === "roas-drop") {
    const rc = detectRoasDrop(data);
    const spendFlat = rc ? "spend held steady" : "spend moved too";
    return `I've scoped it: ${c.title}. ${spendFlat}, so this isn't a budget change — something inside the ad set deteriorated. The per-ad table below names the suspect.`;
  }
  if (c.kind === "funnel-leak") {
    return `Scoped to ${c.title}. The rest of the funnel is healthy — the bleed is at this one step. Drill into the numbers below, then we'll peel why.`;
  }
  const a = data.adsets.find((x) => x.id === c.adsetId);
  if (a) {
    return `Scoped: ${a.name} reports ${fmtX(a.platform_roas)} on the platform but earns ${fmtX(a.true_poas)} in profit. That's a ${fmtX(a.gap)} gap — the dashboard's prettiest number is its least honest. Let's open the margin.`;
  }
  return "Scoped. Let's open the numbers below.";
}

/** P1-04: the Diagnose note follows the peel. Before the first peel it scopes;
 *  after each peel it verdicts the newest layer; the full summary lands only
 *  when every layer is revealed. */
function diagnoseNote(c: CaseItem, data: DemoData, opts: NarrateOpts): string {
  const layers = evidenceLayers(c, data);
  const total = opts.totalLayers ?? layers.length;
  const revealed = opts.revealed ?? total;
  if (total > 0 && revealed < total) {
    if (revealed <= 1) return diagnoseScope(c, data);
    const newest = layers[revealed - 1];
    if (newest) {
      return `${newest.title} — verdict: ${newest.verdict === "ok" ? "ruled out, looks fine" : "that's where it hurts"}. ${revealed} of ${total} layers peeled — keep going.`;
    }
  }
  return diagnoseSummary(c, data);
}

function diagnoseScope(c: CaseItem, data: DemoData): string {
  if (c.kind === "roas-drop") {
    return `Starting the peel on ${c.title} — first question: are you overpaying for clicks? Peel the layers and I'll rule things out one by one.`;
  }
  if (c.kind === "funnel-leak" && c.channel && c.stepIdx !== null) {
    return `Starting the peel on ${channelLabel(c.channel)} ${stepLabel(c.stepIdx - 1)} → ${stepLabel(c.stepIdx)} — first question: is traffic the problem? Peel and I'll narrow it down.`;
  }
  const a = data.adsets.find((x) => x.id === c.adsetId);
  if (a) {
    return `Starting the peel on ${a.name} (${fmtX(a.platform_roas)} on the platform) — first question: what does the platform see? Peel and I'll open the margin.`;
  }
  return "Peel the first layer and I'll tell you what it rules out.";
}

function diagnoseSummary(c: CaseItem, data: DemoData): string {
  if (c.kind === "roas-drop") {
    const rc = detectRoasDrop(data);
    if (rc) {
      return `I peeled the layers so you don't have to: CPC ${fmtEGP(rc.cpcThen)} → ${fmtEGP(rc.cpcNow)} (you're not overpaying), CTR ${fmtPct(rc.ctrThen)} → ${fmtPct(rc.ctrNow)} (the ads still pull). The damage is post-click — baskets shrank ${fmtPct(rc.aovChangePct)} and failed deliveries went ${fmtPct(rc.failThen)} → ${fmtPct(rc.failNow)}.`;
    }
  }
  if (c.kind === "funnel-leak") {
    return `Traffic is fine — buyers arrive and then stall at this step. The checklist below is heuristic: the data tells us where the leak is, confirming which cause is real takes a look. Recover first, fix the cause second.`;
  }
  const a = data.adsets.find((x) => x.id === c.adsetId);
  if (a) {
    const e = a.economics;
    const total = e.revenue_egp || 1;
    return `Here's where the margin went: COGS ${fmtEGP(e.cogs_egp)} (${fmtPct((e.cogs_egp / total) * 100)} of revenue), shipping ${fmtEGP(e.ship_egp)}, and ${fmtEGP(e.failed_egp)} burned on failed deliveries. The platform never sees any of this — that's the whole gap.`;
  }
  return "Evidence above. Here's my read.";
}

function decideNote(c: CaseItem, data: DemoData, opts: NarrateOpts): string {
  const base = opts.approved ? decideApproved(c, data) : decidePending(c, data);
  // P2 §7.7: the override is the marketer's call — the Analyst keeps it.
  return opts.override ? `${base} You disagreed with me on this one. I've kept your call.` : base;
}

function decidePending(c: CaseItem, data: DemoData): string {
  if (c.kind === "roas-drop") {
    const rc = detectRoasDrop(data);
    const budget = rc?.culprit ? fmtEGP(rc.culprit.spend_egp) : "its budget";
    return `My recommendation: pause the culprit creative and shift ${budget}/mo to the ad set's top-profit creatives. In production this would execute on your approval and I'd watch the recovery. Here, approving moves it to the watchlist.`;
  }
  if (c.kind === "funnel-leak") {
    return `My recommendation: recover the abandoned volume now (retargeting/WhatsApp nudge on approval), then fix the cause the checklist points at. Approve and I'll put this transition on the watchlist.`;
  }
  const a = data.adsets.find((x) => x.id === c.adsetId);
  if (a) {
    return `My recommendation: cut ${a.name}'s budget ${fmtEGP(a.spend_egp)}/mo to zero or fix the margin — at ${fmtX(a.true_poas)} every extra pound of spend loses money. Approve and I'll watch what happens to the blended POAS.`;
  }
  return "Approve the action and I'll put it on the watchlist.";
}

/** P1-04: after approval the note must not invite approval again. */
function decideApproved(c: CaseItem, data: DemoData): string {
  if (c.kind === "roas-drop") {
    const rc = detectRoasDrop(data);
    const budget = rc?.culprit ? fmtEGP(rc.culprit.spend_egp) : "its budget";
    return `Approved — the pause and the ${budget}/mo budget shift are on the watchlist. In production this is where they'd execute and I'd track the recovery.`;
  }
  if (c.kind === "funnel-leak" && c.channel && c.stepIdx !== null) {
    return `Approved — recovering the ${stepLabel(c.stepIdx).toLowerCase()} volume is on the watchlist. In production the nudge would go out from here and I'd watch the ${stepLabel(c.stepIdx - 1)} → ${stepLabel(c.stepIdx)} rate come back.`;
  }
  const a = data.adsets.find((x) => x.id === c.adsetId);
  if (a) {
    return `Approved — cutting ${fmtEGP(a.spend_egp)}/mo of losing spend is on the watchlist. In production I'd watch the blended POAS lift from here.`;
  }
  return "Approved — it's on the watchlist. In production this is where execution and tracking would start.";
}

function verifyNote(c: CaseItem, brandName: string): string {
  void brandName;
  const money = c.impactEgp !== null ? ` (${fmtEGP(c.impactEgp)}/mo at stake)` : "";
  return `On the watchlist${money}. In production I'd check this metric daily and flag you the moment it recovers — or doesn't. That's the loop most dashboards never close.`;
}

/** Metrics payload for the live narration call — governed aggregates only. */
export function narrationMetrics(
  stage: Stage,
  c: CaseItem,
  data: DemoData,
  opts: NarrateOpts = {}
): Record<string, unknown> {
  const a = data.adsets.find((x) => x.id === c.adsetId);
  return {
    stage,
    case_title: c.title,
    case_kind: c.kind,
    impact_egp_monthly: c.impactEgp,
    // P1-04: live mode sees how far the peel has gone.
    ...(stage === "diagnose" && opts.totalLayers
      ? {
          layers_revealed: { revealed: opts.revealed ?? opts.totalLayers, total: opts.totalLayers },
        }
      : {}),
    adset: a
      ? {
          name: a.name,
          spend_egp: a.spend_egp,
          platform_roas: a.platform_roas,
          true_poas: a.true_poas,
          economics: a.economics,
        }
      : null,
  };
}
