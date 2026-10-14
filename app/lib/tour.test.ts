/**
 * Phase 4 — unit tests for the presenter-mode step scripts (`lib/tour.ts`).
 *
 * The tracks are typed data plus caption functions of the computed context, so
 * these tests pin two things the Playwright specs can't easily isolate: the
 * context math (including the empty / unsized / snoozed edges) and the
 * structural invariants every step must satisfy.
 *
 * Run:  npx vitest run   (or: npm test)
 */
import { describe, expect, test } from "vitest";
import {
  MARKETER_TRACK,
  TOP_CASE,
  VONDERA_TRACK,
  resolveTopCase,
  tourContext,
  trackSteps,
  type TourStep,
} from "./tour";
import { sampleData } from "./data";
import { buildCases } from "./cases";
import { fmtEGP } from "./format";

const cases = buildCases(sampleData);
const ALL_IDS = cases.map((c) => c.id);

describe("tourContext", () => {
  test("computes the headline figures from the sample", () => {
    const ctx = tourContext(sampleData);
    expect(ctx.roas).toBe("3.49×");
    expect(ctx.poas).toBe("1.19×");
    expect(ctx.over).toBe("2.92×");
  });

  test("waiting list defaults to all four sample cases, ranked", () => {
    const ctx = tourContext(sampleData);
    expect(ctx.waitingCount).toBe(4);
    expect(ctx.topTitle).toBe("TikTok Checkout → Purchase leak");
    expect(ctx.topImpact).toBe(fmtEGP(269340));
  });

  test("empty waiting list → honest fallback copy", () => {
    const ctx = tourContext(sampleData, ALL_IDS);
    expect(ctx.waitingCount).toBe(0);
    expect(ctx.topTitle).toBe("nothing waiting");
    expect(ctx.topImpact).toBe("unsized impact");
  });

  test("top case with null impact → 'unsized impact'", () => {
    const withoutSized = ALL_IDS.filter((id) => id !== "drop-spring-broad");
    const ctx = tourContext(sampleData, withoutSized);
    expect(ctx.waitingCount).toBe(1);
    expect(ctx.topTitle).toBe("Spring Collection – Broad: ROAS −14%");
    expect(ctx.topImpact).toBe("unsized impact");
  });

  test("watchlist removes a case; the next one becomes top", () => {
    const ctx = tourContext(sampleData, ["leak-tiktok-3"]);
    expect(ctx.waitingCount).toBe(3);
    expect(ctx.topTitle).toBe("Lookalike – Purchasers looks profitable, loses money");
    expect(ctx.topImpact).toBe(fmtEGP(24000));
  });

  test("a snoozed, not-yet-resurfaced case is hidden", () => {
    const ctx = tourContext(sampleData, [], {
      "leak-tiktok-3": { kind: "snoozed", resurfaced: false },
    });
    expect(ctx.waitingCount).toBe(3);
  });

  test("a snoozed case that resurfaced returns to the top", () => {
    const ctx = tourContext(sampleData, [], {
      "leak-tiktok-3": { kind: "snoozed", resurfaced: true },
    });
    expect(ctx.waitingCount).toBe(4);
    expect(ctx.topTitle).toBe("TikTok Checkout → Purchase leak");
  });

  test("omitted watchlist / dispositions behave like empty ones", () => {
    expect(tourContext(sampleData)).toEqual(tourContext(sampleData, [], {}));
  });

  test("zero spend → ratios fall back to 0.00×, never NaN", () => {
    const empty = {
      ...sampleData,
      adsets: sampleData.adsets.map((a) => ({ ...a, spend_egp: 0 })),
    };
    const ctx = tourContext(empty);
    expect(ctx.roas).toBe("0.00×");
    expect(ctx.poas).toBe("0.00×");
    expect(ctx.over).toBe("0.00×");
  });
});

describe("resolveTopCase", () => {
  test("returns the top waiting id", () => {
    expect(resolveTopCase(sampleData, [], {})).toBe("leak-tiktok-3");
  });

  test("null when nothing waits", () => {
    expect(resolveTopCase(sampleData, ALL_IDS, {})).toBeNull();
  });

  test("agrees with tourContext's topTitle", () => {
    const id = resolveTopCase(sampleData, [], {});
    const ctx = tourContext(sampleData, [], {});
    expect(ctx.topTitle).toBe(cases.find((c) => c.id === id)?.title);
  });
});

describe("trackSteps", () => {
  test("returns the requested track by reference", () => {
    expect(trackSteps("vondera")).toBe(VONDERA_TRACK);
    expect(trackSteps("marketer")).toBe(MARKETER_TRACK);
  });

  test("TOP_CASE is the documented sentinel", () => {
    expect(TOP_CASE).toBe("__top__");
  });
});

const TRACKS: Array<[string, TourStep[]]> = [
  ["vondera", VONDERA_TRACK],
  ["marketer", MARKETER_TRACK],
];

describe.each(TRACKS)("%s track structure", (name, track) => {
  test("has steps", () => {
    expect(track.length).toBeGreaterThan(0);
  });

  test("ids are unique", () => {
    const ids = track.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every step declares its own track", () => {
    for (const s of track) expect(s.track).toBe(name);
  });

  test("every step has a title, notes and a caption", () => {
    for (const s of track) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.notes.length).toBeGreaterThan(0);
      expect(typeof s.caption).toBe("function");
    }
  });

  test("captions are non-empty for the sample context", () => {
    const ctx = tourContext(sampleData);
    for (const s of track) expect(s.caption(ctx).length).toBeGreaterThan(0);
  });

  test("views are valid shell views", () => {
    const valid = new Set(["home", "detect", "upload", "verify"]);
    for (const s of track) {
      if (typeof s.view === "string") expect(valid.has(s.view)).toBe(true);
      else expect(s.view.case).toBe(TOP_CASE);
    }
  });

  test("stages are valid case stages", () => {
    const valid = new Set(["detect", "isolate", "diagnose", "decide", "verify"]);
    for (const s of track) if (s.stage) expect(valid.has(s.stage)).toBe(true);
  });

  test("demoActions come from the known set", () => {
    const valid = new Set(["approve-top", "snooze-top", "disagree-top", "reset"]);
    for (const s of track) if (s.demoAction) expect(valid.has(s.demoAction)).toBe(true);
  });
});

describe("track shape", () => {
  test("both tracks are ten scripted steps", () => {
    expect(VONDERA_TRACK).toHaveLength(10);
    expect(MARKETER_TRACK).toHaveLength(10);
  });

  test("step ids are unique across both tracks", () => {
    const ids = [...VONDERA_TRACK, ...MARKETER_TRACK].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("each track resets on its final step", () => {
    expect(VONDERA_TRACK.at(-1)?.demoAction).toBe("reset");
    expect(MARKETER_TRACK.at(-1)?.demoAction).toBe("reset");
  });

  test("each track opens the live top case at least once", () => {
    for (const track of [VONDERA_TRACK, MARKETER_TRACK]) {
      const opensTop = track.some((s) => typeof s.view === "object" && s.view.case === TOP_CASE);
      expect(opensTop).toBe(true);
    }
  });

  test("only the Vondera track opens the Ask drawer", () => {
    expect(VONDERA_TRACK.filter((s) => s.openAsk)).toHaveLength(1);
    expect(MARKETER_TRACK.filter((s) => s.openAsk)).toHaveLength(0);
  });
});

describe("captions", () => {
  const ctx = tourContext(sampleData);

  test("fixed captions ignore the context", () => {
    const step = VONDERA_TRACK.find((s) => s.id === "v-home")!;
    const other = { ...ctx, roas: "9.99×", topTitle: "different" };
    expect(step.caption(ctx)).toBe(step.caption(other));
  });

  test("the hook caption embeds the computed figures", () => {
    const step = VONDERA_TRACK.find((s) => s.id === "v-hooks")!;
    const text = step.caption(ctx);
    expect(text).toContain(ctx.roas);
    expect(text).toContain(ctx.poas);
    expect(text).toContain(ctx.over);
  });

  test("the hitlist caption counts cases and sizes the top impact", () => {
    const step = VONDERA_TRACK.find((s) => s.id === "v-hitlist")!;
    const text = step.caption(ctx);
    expect(text).toContain(String(ctx.waitingCount));
    expect(text).toContain(ctx.topImpact);
  });

  test("the marketer opener names the top case", () => {
    const step = MARKETER_TRACK.find((s) => s.id === "m-focus")!;
    expect(step.caption(ctx)).toContain(ctx.topTitle);
  });

  test("context-aware captions follow the waiting list", () => {
    const empty = tourContext(sampleData, ALL_IDS);
    const hitlist = VONDERA_TRACK.find((s) => s.id === "v-hitlist")!;
    expect(hitlist.caption(empty)).not.toBe(hitlist.caption(ctx));
    expect(hitlist.caption(empty)).toContain("0 cases");
  });

  test("the reset caption is shared by both tracks", () => {
    const v = VONDERA_TRACK.find((s) => s.id === "v-reset")!;
    const m = MARKETER_TRACK.find((s) => s.id === "m-reset")!;
    expect(v.caption(ctx)).toBe(m.caption(ctx));
    expect(v.caption(ctx)).toContain("clean slate");
  });

  test("no caption hardcodes the sample's live top impact", () => {
    const empty = tourContext(sampleData, ALL_IDS);
    for (const s of [...VONDERA_TRACK, ...MARKETER_TRACK]) {
      expect(s.caption(empty)).not.toContain("269,340");
    }
  });
});
