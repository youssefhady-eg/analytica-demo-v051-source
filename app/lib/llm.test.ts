/**
 * Level-2 (BYOK) tests — the only network surface in the app.
 *
 * `fetch` is stubbed so nothing leaves the process. These lock in the
 * governance contract: the Authorization header carries the key, and only
 * already-computed metrics are ever sent (never raw rows).
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { analystAsk, analystNarrate, DEFAULT_ENDPOINT, DEFAULT_MODEL, type AskBundle } from "./llm";

const OPTS = { apiKey: "sk-test-key", endpoint: DEFAULT_ENDPOINT, model: DEFAULT_MODEL };

const BUNDLE: AskBundle = {
  headlines: { spend_egp: 80000, platform_roas: 3.49, true_poas: 1.19, overstatement: 2.92 },
  cases: [{ title: "TikTok checkout leak", kind: "funnel-leak", impact_egp_monthly: 269340 }],
  watchlist_titles: [],
  snoozed_count: 1,
  resolved_count: 0,
  human_overrides: [],
};

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    temperature: number;
    max_tokens: number;
    messages: { role: string; content: string }[];
  };
}

/** Install a fetch stub returning `content`; returns the captured request. */
function stubFetch(
  content: string | null,
  init: { ok?: boolean; status?: number } = {}
): { captured: Captured } {
  const captured = {} as Captured;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: { headers: Record<string, string>; body: string }) => {
      captured.url = url;
      captured.headers = options.headers;
      captured.body = JSON.parse(options.body);
      const ok = init.ok ?? true;
      return {
        ok,
        status: init.status ?? 200,
        text: async () => "error body",
        json: async () => ({ choices: content === null ? [] : [{ message: { content } }] }),
      };
    })
  );
  return { captured };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analystAsk", () => {
  test("sends the key, model and governed bundle; returns trimmed text", async () => {
    const { captured } = stubFetch("  The dashboard overstates by 2.92×.  ");
    const text = await analystAsk("What's my real ROAS?", BUNDLE, OPTS);

    expect(text).toBe("The dashboard overstates by 2.92×.");
    expect(captured.url).toBe(DEFAULT_ENDPOINT);
    expect(captured.headers.Authorization).toBe("Bearer sk-test-key");
    expect(captured.body.model).toBe(DEFAULT_MODEL);
    expect(captured.body.messages[0].role).toBe("system");
    // Only the computed bundle is sent — no raw order rows.
    expect(captured.body.messages[1].content).toContain("80000");
    expect(captured.body.messages[1].content).toContain("TikTok checkout leak");
    expect(captured.body.messages[1].content).not.toContain("order_id");
  });

  test("system prompt carries the governance rules", async () => {
    const { captured } = stubFetch("ok");
    await analystAsk("hi", BUNDLE, OPTS);
    const system = captured.body.messages[0].content;
    expect(system).toMatch(/recommend only/i);
    expect(system).toMatch(/never invent/i);
    expect(system).toMatch(/COD/);
  });

  test("throws with the status on a non-ok response", async () => {
    stubFetch("nope", { ok: false, status: 401 });
    await expect(analystAsk("hi", BUNDLE, OPTS)).rejects.toThrow(/401/);
  });

  test("throws when the model returns no text", async () => {
    stubFetch(null);
    await expect(analystAsk("hi", BUNDLE, OPTS)).rejects.toThrow(/no text/i);
  });
});

describe("analystNarrate", () => {
  test("includes the stage and case title, and returns the model text", async () => {
    const { captured } = stubFetch("I scoped it and the leak is post-click.");
    const metrics = { stage: "isolate", case_kind: "roas-drop", adset: { name: "Spring" } };
    const text = await analystNarrate("isolate", "Spring: ROAS −14%", metrics, OPTS);

    expect(text).toBe("I scoped it and the leak is post-click.");
    expect(captured.body.messages[1].content).toContain("isolate");
    expect(captured.body.messages[1].content).toContain("Spring: ROAS −14%");
    expect(captured.body.temperature).toBe(0.4);
  });
});
