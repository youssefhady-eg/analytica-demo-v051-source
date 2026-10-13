import {
  buildCases,
  casePlan,
  getCase,
  waitingCases,
  MONEY_MAX_POAS,
  MONEY_MIN_ROAS,
  type CaseItem,
  type DispositionStatus,
} from "./cases";
import { detectRoasDrop, ROAS_DROP_MIN_PCT } from "./diagnose";
import { channelLabel, computeLeaks, stepLabel } from "./funnel";
import { fmtEGP, fmtPct, fmtX } from "./format";
import type { DemoData } from "./types";

/**
 * Phase 5 — Ask Vondera panel (mock, rules-driven). A deterministic intent
 * matcher over governed computed metrics: every figure in every answer comes
 * from the data below, never from prose. English-only matcher for v1.
 */

// i18n seam (v1: English only): all matchers funnel through normalize() plus
// the word lists in detectIntent — a second language plugs in beside them.
export function normalize(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type AskIntent =
  | "focus"
  | "lie"
  | "leak"
  | "drop"
  | "profit"
  | "status"
  | "compare"
  | "help";

export interface AskSnapshot {
  data: DemoData;
  waiting: CaseItem[];
  /** Watchlist ids that still resolve to a case. */
  watched: CaseItem[];
  handled: { id: string; kind: string; title: string }[];
  snoozedCount: number;
  resolvedCount: number;
  overrideCount: number;
}

export function snapshotAsk(
  data: DemoData,
  watchlist: string[],
  dispositions: Record<string, DispositionStatus>
): AskSnapshot {
  const waiting = waitingCases(data, watchlist, dispositions);
  const watched = watchlist
    .map((id) => getCase(data, id))
    .filter((c): c is CaseItem => c !== null);
  const handled = Object.entries(dispositions)
    .filter(([, d]) => d.kind === "resolved" || d.kind === "snoozed" || d.kind === "override")
    .map(([id, d]) => ({ id, d, c: getCase(data, id) }))
    .filter((r): r is { id: string; d: DispositionStatus; c: CaseItem } => r.c !== null)
    .map((r) => ({ id: r.id, kind: r.d.kind, title: r.c.title }));
  const count = (k: string) => handled.filter((h) => h.kind === k).length;
  return {
    data,
    waiting,
    watched,
    handled,
    snoozedCount: count("snoozed"),
    resolvedCount: count("resolved"),
    overrideCount: count("override"),
  };
}

export interface AskAnswer {
  intent: AskIntent | "action";
  text: string;
  answeredFrom: string[];
  followUp: string[];
  caseId: string | null;
}

const has = (q: string, re: RegExp): boolean => re.test(q);

/** Action requests ("pause that ad", "approve the top case") never execute —
 *  they get a recommendation plus the case plan. Checked before intent
 *  matching. Wh-question framing ("what did I snooze") is exempt so history
 *  questions still route to status. */
const ACTION_VERBS_RE =
  /\b(approve|approving|pause|pausing|stop|stopping|scale|scaling|increase|increasing|decrease|decreasing|cut|cutting|launch|launching|snooze|snoozing|dismiss|dismissing|apply|applying|execute|executing|kill|killing|boost|boosting|shut off|turn off|do it|run it|go ahead|make it happen)\b/;
const QUESTION_START_RE =
  /^(what|which|how|when|why|who|whom|whose|show me|list|tell me|have i|did i)\b/;

export function isActionRequest(question: string): boolean {
  const q = normalize(question);
  if (QUESTION_START_RE.test(q)) return false;
  return ACTION_VERBS_RE.test(q);
}

export function detectIntent(question: string): AskIntent {
  const q = normalize(question);
  if (has(q, /\b(what did i|watchlist|watching|approved|snooze|snoozed|dismiss|dismissed|handled|resolved|override|status|my calls|my decisions)\b/)) return "status";
  if (has(q, /\b(vs|versus|compare|comparison|channels?)\b/) || has(q, /\bmeta\b.*\btiktok\b|\btiktok\b.*\bmeta\b/)) return "compare";
  if (has(q, /\b(drop|dropped|dropping|decline|declined|fell|fallen|broad|spring collection)\b/)) return "drop";
  if (has(q, /\b(leak|leaking|funnel|checkout|abandon|stall)\b/)) return "leak";
  if (has(q, /\b(lie|lies|losing money|lose money|fake|looks profitable|unprofitable|bleed|bleeding)\b/)) return "lie";
  if (has(q, /\b(real roas|true roas|true number|true profit|true poas|really earn|blended|overstat|overall|in total|how much.*(spend|profit))\b/)) return "profit";
  if (has(q, /\b(focus|start|first|priorit|top|attention|biggest|matter|important|next|where.*(look|focus|start)|what.*(matter|first|next))\b/)) return "focus";
  return "help";
}

function headlines(s: AskSnapshot): { spend: number; roas: number; poas: number; over: number } {
  const adsets = s.data.adsets;
  const spend = adsets.reduce((x, a) => x + a.spend_egp, 0);
  const profit = adsets.reduce((x, a) => x + a.profit_egp, 0);
  const roas = spend ? adsets.reduce((x, a) => x + a.platform_roas * a.spend_egp, 0) / spend : 0;
  const poas = spend ? profit / spend : 0;
  return { spend, roas, poas, over: poas ? roas / poas : 0 };
}

function moneyOffenders(s: AskSnapshot) {
  return [...s.data.adsets]
    .filter((a) => a.platform_roas >= MONEY_MIN_ROAS && a.true_poas < MONEY_MAX_POAS)
    .sort((a, b) => b.spend_egp - a.spend_egp);
}

function activeLeaks(s: AskSnapshot) {
  return computeLeaks(s.data.funnel, s.data.brand.aov_egp)
    .filter((l) => l.egpImpact > 0)
    .sort((a, b) => b.egpImpact - a.egpImpact);
}

function actionAnswer(s: AskSnapshot): AskAnswer {
  const top = s.waiting[0] ?? null;
  const prefix =
    "I can recommend, but I don't take actions on your behalf — here's what I'd do:";
  if (!top) {
    return {
      intent: "action",
      text: `${prefix} Right now nothing waits, so there is no plan to give. Work a case from triage first.`,
      answeredFrom: ["waiting list · ranked by money"],
      followUp: ["Where should I focus?"],
      caseId: null,
    };
  }
  const steps = casePlan(top, s.data)
    .map((p, i) => `${i + 1}. ${p.title} (${p.when})`)
    .join(" ");
  return {
    intent: "action",
    text: `${prefix} ${top.title}: ${steps} The full plan with timings lives on the case — open it and approve when ready.`,
    answeredFrom: ["waiting list · ranked by money", "case plan"],
    followUp: ["Where should I focus?", ...(s.watched.length > 0 ? ["What did I approve?"] : ["What's my real ROAS?"])],
    caseId: top.id,
  };
}

/** Suggested-question chips, computed from state (§10.1). */
export function suggestedChips(s: AskSnapshot): string[] {
  const chips = ["Where should I focus?", "What's my real ROAS?", "Meta vs TikTok?"];
  if (moneyOffenders(s).length > 0) chips.push("Which ad sets lose money?");
  const leak = activeLeaks(s)[0];
  if (leak) {
    chips.push(
      `Why is ${channelLabel(leak.channel)} ${stepLabel(leak.stepIdx - 1)} → ${stepLabel(leak.stepIdx)} leaking?`
    );
  }
  const rc = detectRoasDrop(s.data);
  if (rc) chips.push(`Why did ${rc.adset.name} ROAS drop?`);
  if (s.watched.length > 0) chips.push("What did I approve?");
  if (s.handled.length > 0) chips.push("What did I snooze or dismiss?");
  return chips;
}

export function answerAsk(s: AskSnapshot, question: string): AskAnswer {
  if (isActionRequest(question)) return actionAnswer(s);
  const intent = detectIntent(question);
  const h = headlines(s);
  switch (intent) {
    case "focus": {
      const top = s.waiting[0] ?? null;
      if (!top) {
        const all = buildCases(s.data);
        return {
          intent,
          text:
            all.length > 0
              ? "Nothing waiting right now — every case is handled or watched. I'll flag you the moment something moves."
              : "Nothing waiting right now — no detector fired. I'll flag you the moment something moves.",
          answeredFrom: ["waiting list · ranked by money"],
          followUp: ["What's my real ROAS?", "Meta vs TikTok?"],
          caseId: null,
        };
      }
      return {
        intent,
        text: `Start with ${top.title} — ${top.detail}`,
        answeredFrom: ["waiting list · ranked by money"],
        followUp: ["What's my real ROAS?", "Which ad sets lose money?"],
        caseId: top.id,
      };
    }
    case "lie": {
      const offenders = moneyOffenders(s);
      if (offenders.length === 0) {
        return {
          intent,
          text: `No ad set reports ${MONEY_MIN_ROAS.toFixed(1)}× or more while earning under ${MONEY_MAX_POAS}× — nothing is hiding behind a pretty ROAS right now.`,
          answeredFrom: ["ad-set economics · platform ROAS vs true POAS"],
          followUp: ["What's my real ROAS?", "Where should I focus?"],
          caseId: null,
        };
      }
      const lines = offenders
        .map(
          (a) =>
            `${a.name}: platform ${a.platform_roas.toFixed(2)}× but true ${a.true_poas.toFixed(2)}× on ${fmtEGP(a.spend_egp)}/mo spend`
        )
        .join("; ");
      return {
        intent,
        text: `These ad sets report healthy and lose money: ${lines}.`,
        answeredFrom: ["ad-set economics · platform ROAS vs true POAS"],
        followUp: ["What's my real ROAS?", "Where should I focus?"],
        caseId: `money-${offenders[0].id}`,
      };
    }
    case "leak": {
      if (!s.data.hasFunnel) {
        return {
          intent,
          text: "Funnel data isn't loaded, so I can't rank leaks. Load funnel.csv and ask me again.",
          answeredFrom: ["funnel.csv (missing)"],
          followUp: ["Where should I focus?", "Meta vs TikTok?"],
          caseId: null,
        };
      }
      const leaks = activeLeaks(s);
      if (leaks.length === 0) {
        return {
          intent,
          text: "No active funnel leaks — every transition holds.",
          answeredFrom: ["funnel.csv · per-transition scan"],
          followUp: ["Where should I focus?", "Meta vs TikTok?"],
          caseId: null,
        };
      }
      const l = leaks[0];
      const from = stepLabel(l.stepIdx - 1);
      const to = stepLabel(l.stepIdx);
      return {
        intent,
        text: `${channelLabel(l.channel)} ${from} → ${to}: ${fmtPct(l.rateThen * 100)} → ${fmtPct(l.rateNow * 100)} — about ${fmtEGP(l.egpImpact)}/mo left on the table.`,
        answeredFrom: [`funnel.csv · ${from} → ${to} per-transition scan`],
        followUp: ["Meta vs TikTok?", "Where should I focus?"],
        caseId: `leak-${l.channel}-${l.stepIdx}`,
      };
    }
    case "drop": {
      const rc = detectRoasDrop(s.data);
      if (!rc) {
        return {
          intent,
          text: s.data.hasDaily
            ? `No sharp ROAS drop in the daily scan — nothing fell ${ROAS_DROP_MIN_PCT}% or more.`
            : "Daily data isn't loaded, so I can't scan for drops. Load daily_adset.csv and ask me again.",
          answeredFrom: [s.data.hasDaily ? "daily scan · first-half vs second-half" : "daily_adset.csv (missing)"],
          followUp: ["Where should I focus?"],
          caseId: null,
        };
      }
      const culprit = rc.culprit
        ? ` Worst earner: ${rc.culprit.ad_name} at ${rc.culprit.poas.toFixed(2)}× profit POAS.`
        : "";
      return {
        intent,
        text: `${rc.adset.name}: ROAS down ${rc.dropPct.toFixed(0)}% across the daily scan. CPC ${fmtEGP(rc.cpcThen)} → ${fmtEGP(rc.cpcNow)} and CTR ${fmtPct(rc.ctrThen)} → ${fmtPct(rc.ctrNow)} held flat — the damage is post-click: AOV ${fmtEGP(rc.first.aov_egp)} → ${fmtEGP(rc.last.aov_egp)}, failed deliveries ${fmtPct(rc.failThen)} → ${fmtPct(rc.failNow)}.${culprit}`,
        answeredFrom: ["daily scan · first-half vs second-half", "culprit creative · profit flags"],
        followUp: ["Where should I focus?", "Which ad sets lose money?"],
        caseId: `drop-${rc.adset.id}`,
      };
    }
    case "profit": {
      return {
        intent,
        text: `Overall the platform claims ${fmtX(h.roas)} and the business earns ${fmtX(h.poas)} on ${fmtEGP(h.spend)} of spend — the dashboard overstates by ${fmtX(h.over)}.`,
        answeredFrom: ["blended platform ROAS · true POAS"],
        followUp: ["Which ad sets lose money?", "Where should I focus?"],
        caseId: null,
      };
    }
    case "status": {
      if (s.watched.length === 0 && s.handled.length === 0) {
        return {
          intent,
          text: "Nothing approved, snoozed or dismissed yet — work a case from triage first.",
          answeredFrom: ["watchlist · handled log"],
          followUp: ["Where should I focus?"],
          caseId: null,
        };
      }
      const bits = [
        `watching ${s.watched.length} on the watchlist`,
        `snoozed ${s.snoozedCount}`,
        `resolved ${s.resolvedCount}`,
        `overrides logged ${s.overrideCount}`,
      ];
      return {
        intent,
        text: `Here's where your calls stand: ${bits.join(", ")}.`,
        answeredFrom: ["watchlist · handled log"],
        followUp: ["Where should I focus?"],
        caseId: null,
      };
    }
    case "compare": {
      if (!s.data.hasFunnel) {
        return {
          intent,
          text: "Funnel data isn't loaded, so I can't compare channels. Load funnel.csv and ask me again.",
          answeredFrom: ["funnel.csv (missing)"],
          followUp: ["Where should I focus?"],
          caseId: null,
        };
      }
      const channels = Array.from(new Set(s.data.funnel.map((r) => r.channel)));
      const rate = (ch: string): number => {
        let sess = 0;
        let purch = 0;
        for (const r of s.data.funnel) {
          if (r.channel !== ch) continue;
          if (r.step === "session") sess += r.count;
          if (r.step === "purchase") purch += r.count;
        }
        return sess > 0 ? (purch / sess) * 100 : 0;
      };
      const lines = channels
        .map((ch) => `${channelLabel(ch)}: ${fmtPct(rate(ch))} of sessions become purchases`)
        .join("; ");
      return {
        intent,
        text: `Channel to channel: ${lines}.`,
        answeredFrom: ["funnel.csv · sessions → purchases per channel"],
        followUp: [
          ...(activeLeaks(s)[0]
            ? [`Why is ${channelLabel(activeLeaks(s)[0].channel)} ${stepLabel(activeLeaks(s)[0].stepIdx - 1)} → ${stepLabel(activeLeaks(s)[0].stepIdx)} leaking?`]
            : []),
          "Where should I focus?",
        ].slice(0, 2),
        caseId: null,
      };
    }
    case "help":
    default: {
      return {
        intent: "help",
        text: "I can only answer from the metrics on screen. Try one of these:",
        answeredFrom: ["fallback — no metrics used"],
        followUp: suggestedChips(s).slice(0, 4),
        caseId: null,
      };
    }
  }
}
