/**
 * Deterministic (Level-1) narration tests. Every string is generated from
 * computed data, so these assert the numbers actually surface in the copy and
 * that stage transitions follow the peel.
 */
import { describe, expect, test } from "vitest";
import { narrate, narrationMetrics, type Stage } from "./narrate";
import { buildCases, type CaseItem } from "./cases";
import { sampleData } from "./data";

const cases = buildCases(sampleData);
const byKind = (k: CaseItem["kind"]): CaseItem => {
  const c = cases.find((x) => x.kind === k);
  if (!c) throw new Error(`no sample case of kind ${k}`);
  return c;
};

describe("narrate", () => {
  test("produces non-empty, figure-bearing copy for every stage", () => {
    const stages: Stage[] = ["detect", "isolate", "diagnose", "decide", "verify"];
    for (const kind of ["funnel-leak", "money-offender", "roas-drop"] as const) {
      const c = byKind(kind);
      for (const stage of stages) {
        const text = narrate(stage, c, sampleData);
        expect(text.length).toBeGreaterThan(20);
        expect(text).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  test("detect names the monthly impact when sized", () => {
    const c = byKind("funnel-leak");
    expect(narrate("detect", c, sampleData)).toContain("269,340");
  });

  test("isolate surfaces the platform-vs-true gap for a profit lie", () => {
    const c = byKind("money-offender");
    const text = narrate("isolate", c, sampleData);
    expect(text).toMatch(/platform|reports/i);
    expect(text).toContain("×");
  });

  test("diagnose follows the peel: scope → per-layer verdict → summary", () => {
    const c = byKind("roas-drop");
    const total = 4;
    const scope = narrate("diagnose", c, sampleData, { revealed: 1, totalLayers: total });
    const mid = narrate("diagnose", c, sampleData, { revealed: 2, totalLayers: total });
    const full = narrate("diagnose", c, sampleData, { revealed: total, totalLayers: total });

    expect(scope).toMatch(/first question/i);
    expect(mid).toMatch(/2 of 4 layers/);
    // The full peel lands the post-click verdict with the AOV figure.
    expect(full).toMatch(/post-click/i);
  });

  test("decide does not invite approval again once approved", () => {
    const c = byKind("funnel-leak");
    const pending = narrate("decide", c, sampleData);
    const approved = narrate("decide", c, sampleData, { approved: true });
    expect(pending).toMatch(/Approve/i);
    expect(approved).not.toMatch(/Approve the action/i);
    expect(approved).toMatch(/Approved/i);
  });

  test("override acknowledges the marketer's call", () => {
    const c = byKind("money-offender");
    expect(narrate("decide", c, sampleData, { override: true })).toMatch(/disagreed/i);
  });

  test("verify shows the money at stake on the watchlist", () => {
    const c = byKind("funnel-leak");
    const text = narrate("verify", c, sampleData);
    expect(text).toMatch(/watchlist/i);
    expect(text).toContain("269,340");
  });
});

describe("narrationMetrics", () => {
  test("carries only governed aggregates — never raw rows", () => {
    const c = byKind("money-offender");
    const m = narrationMetrics("isolate", c, sampleData) as Record<string, unknown>;
    expect(m.stage).toBe("isolate");
    expect(m.case_kind).toBe("money-offender");
    expect(m).not.toHaveProperty("orders");
    expect(JSON.stringify(m)).not.toContain("order_id");
  });

  test("reports peel progress on the diagnose stage", () => {
    const c = byKind("roas-drop");
    const m = narrationMetrics("diagnose", c, sampleData, { revealed: 2, totalLayers: 4 }) as {
      layers_revealed: { revealed: number; total: number };
    };
    expect(m.layers_revealed).toEqual({ revealed: 2, total: 4 });
  });
});
