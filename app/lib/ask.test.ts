/**
 * Phase 5 — Ask panel rules-engine tests (§10, checkpoint 5 gates).
 *
 * - Every intent's worked example answers only from the input data: every
 *   number token in the answer must occur (within display rounding) in the
 *   snapshot's own numbers.
 * - Unmatched input hits the fallback; missing-data intents name the file.
 * - No answer claims an action ("I paused", "I executed", "done").
 * - Every suggested/follow-up chip resolves to a live intent.
 *
 * Run:  npx vitest run   (or: npm test)
 */
import { describe, expect, test } from "vitest";
import {
  answerAsk,
  detectIntent,
  isActionRequest,
  snapshotAsk,
  suggestedChips,
  type AskSnapshot,
} from "./ask";
import { computeLeaks } from "./funnel";
import { detectRoasDrop } from "./diagnose";
import { sampleData } from "./data";

function sampleSnapshot(): AskSnapshot {
  return snapshotAsk(sampleData, [], {});
}

/** All numbers the snapshot legitimately contains: raw data + state counts +
 *  the deterministic derivations answers are built from (leak rates, drop
 *  decomposition, channel rates, headlines). Anything outside this set in an
 *  answer would be an invented figure. */
function legitNumbers(s: AskSnapshot): number[] {
  const nums: number[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(s.data);
  nums.push(s.waiting.length, s.watched.length, s.snoozedCount, s.resolvedCount, s.overrideCount);
  const adsets = s.data.adsets;
  const spend = adsets.reduce((x, a) => x + a.spend_egp, 0);
  const profit = adsets.reduce((x, a) => x + a.profit_egp, 0);
  const roas = spend ? adsets.reduce((x, a) => x + a.platform_roas * a.spend_egp, 0) / spend : 0;
  const poas = spend ? profit / spend : 0;
  nums.push(spend, profit, roas, poas, poas ? roas / poas : 0);
  for (const l of computeLeaks(s.data.funnel, s.data.brand.aov_egp)) {
    nums.push(l.rateThen * 100, l.rateNow * 100, l.egpImpact, l.lostPurchases);
  }
  const rc = detectRoasDrop(s.data);
  if (rc) {
    nums.push(
      rc.dropPct, rc.cpcThen, rc.cpcNow, rc.ctrThen, rc.ctrNow,
      rc.first.aov_egp, rc.last.aov_egp, rc.failThen, rc.failNow
    );
    if (rc.culprit) nums.push(rc.culprit.poas, rc.culprit.spend_egp);
  }
  const channels = Array.from(new Set(s.data.funnel.map((r) => r.channel)));
  for (const ch of channels) {
    let sess = 0;
    let purch = 0;
    for (const r of s.data.funnel) {
      if (r.channel !== ch) continue;
      if (r.step === "session") sess += r.count;
      if (r.step === "purchase") purch += r.count;
    }
    if (sess > 0) nums.push((purch / sess) * 100);
  }
  return nums;
}

/** Every numeric token must match a legit number within display rounding
 *  (half a unit of its last decimal place). Answers with no numbers
 *  (empty states, fallback) pass vacuously. */
function expectNumbersLegit(text: string, legit: number[]) {
  const tokens = text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? [];
  for (const t of tokens) {
    const decimals = t.includes(".") ? t.split(".")[1].length : 0;
    const tol = 0.5 * Math.pow(10, -decimals) + 1e-9;
    const value = parseFloat(t.replace(/,/g, ""));
    const ok = legit.some((n) => Math.abs(n - value) <= tol);
    expect(ok, `number ${t} not found in snapshot data`).toBe(true);
  }
}

const FORBIDDEN = ["I paused", "I executed", "done"];

describe("intent examples from the brief table", () => {
  const cases: Array<[string, string]> = [
    ["Where should I focus?", "focus"],
    ["Which ad sets lose money?", "lie"],
    ["Why is TikTok checkout leaking?", "leak"],
    ["Why did Spring Broad ROAS drop?", "drop"],
    ["What's my real ROAS?", "profit"],
    ["What did I approve?", "status"],
    ["Meta vs TikTok?", "compare"],
  ];
  for (const [q, intent] of cases) {
    test(`${intent}: "${q}" answers from data`, () => {
      const s = sampleSnapshot();
      expect(detectIntent(q)).toBe(intent);
      const a = answerAsk(s, q);
      expect(a.intent).toBe(intent);
      expectNumbersLegit(a.text, legitNumbers(s));
      for (const f of FORBIDDEN) expect(a.text.includes(f)).toBe(false);
      expect(a.answeredFrom.length).toBeGreaterThan(0);
    });
  }
});

describe("status with state", () => {
  test("populated watchlist and log produce countable answers", () => {
    const s = snapshotAsk(
      sampleData,
      ["leak-tiktok-3"],
      { "money-tiktok-prosp": { kind: "snoozed" } }
    );
    const a = answerAsk(s, "What did I approve?");
    expect(a.intent).toBe("status");
    expect(a.text).toContain("watching 1");
    expectNumbersLegit(a.text, legitNumbers(s));
  });
});

describe("fallback and missing data", () => {
  test("unmatched input hits the fallback with chips", () => {
    const s = sampleSnapshot();
    expect(detectIntent("tell me a joke about cats")).toBe("help");
    const a = answerAsk(s, "tell me a joke about cats");
    expect(a.intent).toBe("help");
    expect(a.text).toBe("I can only answer from the metrics on screen. Try one of these:");
    expect(a.followUp.length).toBeGreaterThan(0);
  });

  test("missing-data intents name the missing file", () => {
    const noFunnel = snapshotAsk({ ...sampleData, funnel: [], hasFunnel: false }, [], {});
    expect(answerAsk(noFunnel, "Why is TikTok checkout leaking?").text).toContain("funnel.csv");
    expect(answerAsk(noFunnel, "Meta vs TikTok?").text).toContain("funnel.csv");
    const noDaily = snapshotAsk({ ...sampleData, daily: [], hasDaily: false }, [], {});
    expect(answerAsk(noDaily, "Why did Spring Broad ROAS drop?").text).toContain("daily_adset.csv");
  });
});

describe("action guard", () => {
  test("'pause that ad' recommends without acting", () => {
    const s = sampleSnapshot();
    expect(isActionRequest("pause that ad")).toBe(true);
    const a = answerAsk(s, "pause that ad");
    expect(a.intent).toBe("action");
    expect(a.text.startsWith("I can recommend, but I don't take actions on your behalf — here's what I'd do:")).toBe(true);
    expect(a.caseId).not.toBeNull();
    for (const f of FORBIDDEN) expect(a.text.includes(f)).toBe(false);
  });

  test("exact phrase 'approve the top case' is refused with a plan pointer", () => {
    const s = sampleSnapshot();
    expect(isActionRequest("approve the top case")).toBe(true);
    const a = answerAsk(s, "approve the top case");
    expect(a.intent).toBe("action");
    expect(a.text.startsWith("I can recommend, but I don't take actions on your behalf — here's what I'd do:")).toBe(true);
    expect(a.caseId).toBe("leak-tiktok-3");
    expect(a.text).toContain("open it");
    for (const f of FORBIDDEN) expect(a.text.includes(f)).toBe(false);
  });

  test("action verb variants route to the guard", () => {
    const s = sampleSnapshot();
    const variants = [
      "snooze this case",
      "dismiss it",
      "scale the winners",
      "cut spend on broad",
      "launch it",
      "increase tiktok spend",
      "decrease meta budget",
      "do it",
    ];
    for (const q of variants) {
      expect(isActionRequest(q), q).toBe(true);
      const a = answerAsk(s, q);
      expect(a.intent, q).toBe("action");
      expect(a.text.startsWith("I can recommend, but I don't take actions on your behalf — here's what I'd do:"), q).toBe(true);
      for (const f of FORBIDDEN) expect(a.text.includes(f), `${q} contains ${f}`).toBe(false);
    }
  });

  test("history questions with action verbs still reach status", () => {
    expect(isActionRequest("what did I snooze")).toBe(false);
    expect(isActionRequest("What did I snooze or dismiss?")).toBe(false);
    expect(isActionRequest("have I approved anything")).toBe(false);
    const s = sampleSnapshot();
    expect(answerAsk(s, "what did I snooze").intent).toBe("status");
    expect(detectIntent("What did I snooze or dismiss?")).toBe("status");
  });

  test("no answer anywhere claims an action", () => {
    const s = sampleSnapshot();
    const probes = [
      "Where should I focus?",
      "Which ad sets lose money?",
      "Why is TikTok checkout leaking?",
      "Why did Spring Broad ROAS drop?",
      "What's my real ROAS?",
      "What did I approve?",
      "Meta vs TikTok?",
      "pause that ad",
      "scale the winners",
      "nonsense query xyz",
    ];
    for (const q of probes) {
      const text = answerAsk(s, q).text;
      for (const f of FORBIDDEN) expect(text.includes(f), `${q} contains ${f}`).toBe(false);
    }
  });
});

describe("chips always resolve", () => {
  test("every suggested chip hits a live intent", () => {
    const s = sampleSnapshot();
    const chips = suggestedChips(s);
    expect(chips.length).toBeGreaterThanOrEqual(3);
    for (const chip of chips) {
      expect(detectIntent(chip), chip).not.toBe("help");
    }
    // "What did I approve?" appears only with a non-empty watchlist.
    expect(chips.includes("What did I approve?")).toBe(false);
    const withWatch = snapshotAsk(sampleData, ["leak-tiktok-3"], {});
    expect(suggestedChips(withWatch).includes("What did I approve?")).toBe(true);
  });

  test("every follow-up chip hits a live intent", () => {
    const s = sampleSnapshot();
    const probes = [
      "Where should I focus?",
      "Which ad sets lose money?",
      "Why is TikTok checkout leaking?",
      "Why did Spring Broad ROAS drop?",
      "What's my real ROAS?",
      "Meta vs TikTok?",
    ];
    const seen = new Set<string>();
    for (const q of probes) {
      for (const f of answerAsk(s, q).followUp) {
        if (seen.has(f)) continue;
        seen.add(f);
        expect(detectIntent(f), f).not.toBe("help");
      }
    }
  });
});
