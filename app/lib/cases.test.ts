/**
 * Phase 2 — unit tests for the snooze/re-surface math (§7.3) and the
 * waiting-list selector's disposition rule.
 *
 * Run:  npx vitest run   (or: npm test)
 */
import { describe, expect, test } from "vitest";
import {
  buildCases,
  isWorsened,
  waitingCases,
  worseningMetric,
  WORSEN_TOLERANCE,
  type WorseningSnapshot,
} from "./cases";
import { sampleData } from "./data";

describe("isWorsened", () => {
  test("tolerance constant is 2% relative", () => {
    expect(WORSEN_TOLERANCE).toBe(0.02);
  });

  test("equal → false (both directions)", () => {
    expect(isWorsened({ kind: "funnel-leak", value: 100 }, 100)).toBe(false);
    expect(isWorsened({ kind: "money-offender", value: 0.8 }, 0.8)).toBe(false);
    expect(isWorsened({ kind: "roas-drop", value: 14 }, 14)).toBe(false);
  });

  test("1% worse → false (inside tolerance)", () => {
    expect(isWorsened({ kind: "funnel-leak", value: 100 }, 101)).toBe(false);
    expect(isWorsened({ kind: "money-offender", value: 0.8 }, 0.792)).toBe(false);
    expect(isWorsened({ kind: "roas-drop", value: 14 }, 14.14)).toBe(false);
  });

  test("5% worse → true (outside tolerance)", () => {
    expect(isWorsened({ kind: "funnel-leak", value: 100 }, 105)).toBe(true);
    expect(isWorsened({ kind: "money-offender", value: 0.8 }, 0.76)).toBe(true);
    expect(isWorsened({ kind: "roas-drop", value: 14 }, 14.7)).toBe(true);
  });

  test("better → false", () => {
    expect(isWorsened({ kind: "funnel-leak", value: 100 }, 90)).toBe(false);
    expect(isWorsened({ kind: "money-offender", value: 0.8 }, 0.9)).toBe(false);
    expect(isWorsened({ kind: "roas-drop", value: 14 }, 10)).toBe(false);
  });

  test("missing metric → false", () => {
    expect(isWorsened({ kind: "funnel-leak", value: null }, 105)).toBe(false);
    expect(isWorsened({ kind: "funnel-leak", value: 100 }, null)).toBe(false);
    expect(isWorsened({ kind: "funnel-leak", value: null }, null)).toBe(false);
  });
});

describe("worseningMetric directions on the sample", () => {
  const cases = buildCases(sampleData);
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));

  test("funnel-leak tracks egpImpact (higher = worse)", () => {
    const m = worseningMetric(byId["leak-tiktok-3"], sampleData);
    expect(m).toBe(269340);
    expect(isWorsened({ kind: "funnel-leak", value: m }, (m ?? 0) * 1.1)).toBe(true);
  });

  test("money-offender tracks true_poas (lower = worse)", () => {
    const m = worseningMetric(byId["money-lookalike-purch"], sampleData);
    expect(m).toBeCloseTo(0.824, 3);
    expect(isWorsened({ kind: "money-offender", value: m }, (m ?? 0) * 0.9)).toBe(true);
    expect(isWorsened({ kind: "money-offender", value: m }, (m ?? 0) * 1.1)).toBe(false);
  });

  test("roas-drop tracks dropPct (higher = worse)", () => {
    const m = worseningMetric(byId["drop-spring-broad"], sampleData);
    expect(m).not.toBeNull();
    expect(isWorsened({ kind: "roas-drop", value: m }, (m ?? 0) * 1.1)).toBe(true);
  });
});

describe("waitingCases dispositions", () => {
  test("no dispositions → everything waits", () => {
    expect(waitingCases(sampleData, []).length).toBe(4);
  });

  test("disposed cases leave the list at their rank; undo restores order", () => {
    const disp = {
      "leak-tiktok-3": { kind: "resolved" as const },
      "money-tiktok-prosp": { kind: "snoozed" as const },
    };
    const waiting = waitingCases(sampleData, [], disp);
    expect(waiting.map((c) => c.id)).toEqual(["money-lookalike-purch", "drop-spring-broad"]);
    // Undo = drop the disposition → back at the original rank.
    expect(waitingCases(sampleData, [], {}).map((c) => c.id)).toEqual([
      "leak-tiktok-3",
      "money-lookalike-purch",
      "money-tiktok-prosp",
      "drop-spring-broad",
    ]);
  });

  test("resurfaced snooze waits again; quiet snooze does not", () => {
    const waiting = waitingCases(sampleData, [], {
      "money-tiktok-prosp": { kind: "snoozed" as const, resurfaced: true },
      "money-lookalike-purch": { kind: "snoozed" as const },
    });
    expect(waiting.map((c) => c.id)).toEqual([
      "leak-tiktok-3",
      "money-tiktok-prosp",
      "drop-spring-broad",
    ]);
  });

  test("snapshot type flows through the selector", () => {
    const snap: WorseningSnapshot = { kind: "funnel-leak", value: 269340 };
    expect(isWorsened(snap, 269340)).toBe(false);
  });
});
