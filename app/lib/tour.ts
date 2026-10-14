import type { View } from "@/components/ViewShell";
import type { Stage } from "./narrate";
import type { DemoData } from "./types";
import { waitingCases, type DispositionStatus } from "./cases";
import { fmtEGP, fmtX } from "./format";

/** Phase 4 — guided presenter mode. Step scripts are typed data; captions are
 *  functions of the computed context, so no figure is ever hardcoded. */

export type Track = "vondera" | "marketer";

/** Sentinel: the step opens whatever waits at the top right now. */
export const TOP_CASE = "__top__";

export interface TourContext {
  roas: string;
  poas: string;
  over: string;
  waitingCount: number;
  topTitle: string;
  topImpact: string;
}

export function tourContext(
  data: DemoData,
  watchlist: string[] = [],
  dispositions: Record<string, DispositionStatus> = {}
): TourContext {
  const adsets = data.adsets;
  const spend = adsets.reduce((s, a) => s + a.spend_egp, 0);
  const profit = adsets.reduce((s, a) => s + a.profit_egp, 0);
  const roas = spend ? adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / spend : 0;
  const poas = spend ? profit / spend : 0;
  const waiting = waitingCases(data, watchlist, dispositions);
  const top = waiting[0];
  return {
    roas: fmtX(roas),
    poas: fmtX(poas),
    over: fmtX(poas ? roas / poas : 0),
    waitingCount: waiting.length,
    topTitle: top ? top.title : "nothing waiting",
    topImpact: top && top.impactEgp !== null ? fmtEGP(top.impactEgp) : "unsized impact",
  };
}

export type DemoAction = "approve-top" | "snooze-top" | "disagree-top" | "reset";

export interface TourStep {
  id: string;
  track: Track;
  title: string;
  /** Shell view to drive to. `{ case: TOP_CASE }` opens the top waiting case. */
  view: View;
  /** Case stage to set (ViewCase follows when the step's case is open). */
  stage?: Stage;
  /** Peel every evidence layer on arrival (Diagnose). */
  revealLayers?: boolean;
  /** Spotlight target (`data-tour` id). Absent targets never crash. */
  target?: string;
  /** Force the Detect handled-log open on arrival. */
  expandLog?: boolean;
  /** Open the Ask drawer on arrival (Phase 5). */
  openAsk?: boolean;
  /** Demo action the step performs on arrival (approve / dismiss / reset). */
  demoAction?: DemoAction;
  /** Keep demo-only controls visible in Clean view for this step. */
  needsDemoControls?: boolean;
  caption: (ctx: TourContext) => string;
  /** Owner-facing talking points (collapsed Notes in the panel). */
  notes: string;
}

const RESET_CAPTION = "And back to a clean slate — the watchlist and the handled log are cleared.";

export const VONDERA_TRACK: TourStep[] = [
  {
    id: "v-home",
    track: "vondera",
    title: "The thesis",
    view: "home",
    target: "home-hero",
    caption: () => "Analytica turns Vondera's data into an investigation, not another dashboard.",
    notes:
      "Product thesis: Detect → Isolate → Diagnose → Decide → Verify. Data in from Vondera apps, intelligence out to VPal and apps.",
  },
  {
    id: "v-ecosystem",
    track: "vondera",
    title: "The ecosystem",
    view: "home",
    target: "home-ecosystem",
    caption: () =>
      "Data in from Vondera apps, recommendations out to VPal and apps. Analytica diagnoses and proposes; the ecosystem executes.",
    notes:
      "Analytica is one of Vondera's products — intelligence in the middle, execution at the edges. Recommendations only, never auto-execution.",
  },
  {
    id: "v-hooks",
    track: "vondera",
    title: "Your numbers lie",
    view: "detect",
    target: "detect-hooks",
    caption: (ctx) =>
      `The platform says ${ctx.roas}. After costs it earns ${ctx.poas}. That's a ${ctx.over} overstatement.`,
    notes:
      "The hook: blended platform ROAS vs true profit POAS, computed live. This is pillar one.",
  },
  {
    id: "v-hitlist",
    track: "vondera",
    title: "Where to focus",
    view: "detect",
    target: "detect-list",
    caption: (ctx) =>
      `${ctx.waitingCount} cases, ranked by money. The biggest is worth ${ctx.topImpact} a month.`,
    notes:
      "Morning triage: every alert is a case, ranked by EGP impact. START HERE removes ambiguity.",
  },
  {
    id: "v-peel",
    track: "vondera",
    title: "Peel the layers",
    view: { case: TOP_CASE },
    stage: "diagnose",
    revealLayers: true,
    target: "diagnose-layers",
    caption: () => "The Analyst rules things out one layer at a time — and says what it found.",
    notes:
      "The star moment: click-to-peel evidence, each layer ruling something out. Culprit card is rules-detected, checklist is heuristic — say both aloud.",
  },
  {
    id: "v-close",
    track: "vondera",
    title: "Close the loop",
    view: "verify",
    demoAction: "approve-top",
    target: "verify-list",
    caption: () => "The loop most dashboards never close: approve, then watch whether it worked.",
    notes:
      "Entering this step approves the top waiting case (a visible demo action) and lands on the watchlist. Reset at the end undoes it.",
  },
  {
    id: "v-provenance",
    track: "vondera",
    title: "Provenance",
    view: "detect",
    target: "detect-analyst",
    caption: () =>
      "Every line is tagged rules or ✨ live. Nothing is hidden, and no live model is needed to see value.",
    notes:
      "Honesty is the product principle: rules narration by default, BYOK live mode, visible fallbacks, sample-data badges everywhere.",
  },
  {
    id: "v-private",
    track: "vondera",
    title: "Private by design",
    view: "upload",
    target: "upload-files",
    caption: () => "Everything is computed in the browser. Nothing leaves the machine.",
    notes:
      "Merchant CSVs parse and compute locally — the sentence that gets data past legal. No network except the user-initiated BYOK call.",
  },
  {
    id: "v-ask",
    track: "vondera",
    title: "Ask in words",
    view: "detect",
    openAsk: true,
    target: "ask-panel",
    caption: () => "Ask questions in plain words — answered only from governed metrics.",
    notes:
      "The drawer answers from the same governed metrics — click a suggested chip live. Rules by default, ✨ live behind the BYOK toggle.",
  },
  {
    id: "v-reset",
    track: "vondera",
    title: "Reset",
    view: "detect",
    demoAction: "reset",
    target: "detect-list",
    caption: () => RESET_CAPTION,
    notes:
      "Reset clears the watchlist, dispositions and the tour — the demo is exactly as it started.",
  },
];

export const MARKETER_TRACK: TourStep[] = [
  {
    id: "m-focus",
    track: "marketer",
    title: "Start with money",
    view: "detect",
    target: "detect-list",
    caption: (ctx) => `Start where the money is: ${ctx.topTitle}.`,
    notes:
      "The 'would I open this every morning' test: one ranked list, money first. Open the top card.",
  },
  {
    id: "m-scope",
    track: "marketer",
    title: "Scope it",
    view: { case: TOP_CASE },
    stage: "isolate",
    target: "isolate-evidence",
    caption: () => "Scope it before you diagnose it.",
    notes:
      "Isolate is kind-specific: the one view that localizes the damage. Profit-lie cases get the margin decomposition.",
  },
  {
    id: "m-peel",
    track: "marketer",
    title: "Peel it",
    view: { case: TOP_CASE },
    stage: "diagnose",
    revealLayers: true,
    target: "diagnose-layers",
    caption: () => "Peel the layers — each one rules something out.",
    notes:
      "Let the marketer click a peel themselves if time allows — the tactile moment sells the investigation feel.",
  },
  {
    id: "m-plan",
    track: "marketer",
    title: "The plan",
    view: { case: TOP_CASE },
    stage: "decide",
    target: "decide-plan",
    caption: () => "A sequenced plan: what first, what next, what to re-measure.",
    notes:
      "Not one action — a timed sequence with the honesty footnote. Approve closes into Verify; Dismiss asks why.",
  },
  {
    id: "m-snooze",
    track: "marketer",
    title: "Snooze it",
    view: "detect",
    demoAction: "snooze-top",
    expandLog: true,
    needsDemoControls: true,
    target: "handled-log",
    caption: () => "Not ready? Snooze it. It comes back if the numbers get worse.",
    notes:
      "Entering this step snoozes the top case (visible demo action). Open the Handled & snoozed log, then click Simulate worsening (demo) on its row to show the re-surface.",
  },
  {
    id: "m-disagree",
    track: "marketer",
    title: "Disagree",
    view: "detect",
    demoAction: "disagree-top",
    expandLog: true,
    target: "handled-log",
    caption: () => "Think I'm wrong? Say so. It's logged for the Analyst.",
    notes:
      "Entering this step overrides the next case. Overrides append to the Detect note and ride the live-mode metrics — say that aloud.",
  },
  {
    id: "m-verify",
    track: "marketer",
    title: "Verify",
    view: "verify",
    target: "verify-list",
    caption: () =>
      "Every approval lands here. In production, this is where the recovery gets watched.",
    notes:
      "Trust compounds when the tool shows receipts. Empty state teaches the loop if nothing is approved yet.",
  },
  {
    id: "m-upload",
    track: "marketer",
    title: "Your data",
    view: "upload",
    target: "upload-files",
    caption: () => "Bring your own numbers — the whole flow recomputes in the browser.",
    notes:
      "Download template CSVs lands in Phase 6. Today: spend.csv + orders.csv required, rest optional, nothing uploaded anywhere.",
  },
  {
    id: "m-phone",
    track: "marketer",
    title: "On a phone",
    view: "detect",
    target: "detect-list",
    caption: () => "Same flow on a phone.",
    notes:
      "If possible, open the demo on a phone now — 360px layout, sticky action bar, stacked cards.",
  },
  {
    id: "m-reset",
    track: "marketer",
    title: "Reset",
    view: "detect",
    demoAction: "reset",
    caption: () => RESET_CAPTION,
    notes:
      "Reset clears the watchlist, dispositions and the tour — the demo is exactly as it started.",
  },
];

export function trackSteps(track: Track): TourStep[] {
  return track === "vondera" ? VONDERA_TRACK : MARKETER_TRACK;
}

/** Resolve TOP_CASE against what waits right now (null when nothing waits). */
export function resolveTopCase(
  data: DemoData,
  watchlist: string[],
  dispositions: Record<string, DispositionStatus>
): string | null {
  return waitingCases(data, watchlist, dispositions)[0]?.id ?? null;
}
