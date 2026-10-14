"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoData } from "./DataProvider";
import { useAnalyst } from "./AnalystProvider";
import { answerAsk, snapshotAsk, suggestedChips, type AskAnswer } from "@/lib/ask";
import { analystAsk, type AskBundle } from "@/lib/llm";
import { buildCases } from "@/lib/cases";

interface Message {
  q: string;
  a: AskAnswer | null;
  live: boolean;
  liveFailed: string | null;
  thinking: boolean;
}

/** Governed bundle for one live call — the exact object analystAsk sends. */
function buildBundle(
  data: ReturnType<typeof useDemoData>["data"],
  snapshot: ReturnType<typeof snapshotAsk>
): AskBundle {
  const spend = data.adsets.reduce((x, a) => x + a.spend_egp, 0);
  const profit = data.adsets.reduce((x, a) => x + a.profit_egp, 0);
  const roas = spend
    ? data.adsets.reduce((x, a) => x + a.platform_roas * a.spend_egp, 0) / spend
    : 0;
  const poas = spend ? profit / spend : 0;
  return {
    headlines: {
      spend_egp: spend,
      platform_roas: roas,
      true_poas: poas,
      overstatement: poas ? roas / poas : 0,
    },
    cases: buildCases(data).map((c) => ({
      title: c.title,
      kind: c.kind,
      impact_egp_monthly: c.impactEgp,
    })),
    watchlist_titles: snapshot.watched.map((c) => c.title),
    snoozed_count: snapshot.snoozedCount,
    resolved_count: snapshot.resolvedCount,
    human_overrides: snapshot.handled
      .filter((x) => x.kind === "override")
      .map((x) => ({ case_kind: x.kind, case_title: x.title })),
  };
}

/** Phase 5 — Ask Vondera panel (mock, rules-driven). A conversational layer
 *  over governed computed metrics: deterministic answers by default, live
 *  re-verbalization behind the BYOK toggle, visible fallback on any failure.
 *  No history persistence; answers never offer to take actions. */
export default function AskPanel({
  open,
  onClose,
  onOpenCase,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCase: (id: string) => void;
}) {
  const { data, watchlist, dispositions } = useDemoData();
  const { enabled, apiKey, endpoint, model } = useAnalyst();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Answers reference live numbers — a dataset change retires them.
  useEffect(() => {
    // Deliberate reset on dataset change; the rule flags synchronous setState
    // in effects, but retiring stale answers is the intent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    setInput("");
  }, [data.source, data.brand.name]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);

  if (!open) return null;
  const snapshot = snapshotAsk(data, watchlist, dispositions);
  const chips = suggestedChips(snapshot);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const rules = answerAsk(snapshot, q);
    if (!enabled || !apiKey) {
      setMessages((m) => [...m, { q, a: rules, live: false, liveFailed: null, thinking: false }]);
      return;
    }
    const id = messages.length;
    setMessages((m) => [...m, { q, a: null, live: false, liveFailed: null, thinking: true }]);
    setBusy(true);
    try {
      const text = await analystAsk(q, buildBundle(data, snapshot), { apiKey, endpoint, model });
      setMessages((m) =>
        m.map((msg, i) =>
          i === id
            ? {
                q,
                a: { ...rules, text },
                live: true,
                liveFailed: null,
                thinking: false,
              }
            : msg
        )
      );
    } catch (e) {
      const err = e instanceof Error ? e.message : "unknown error";
      setMessages((m) =>
        m.map((msg, i) =>
          i === id ? { q, a: rules, live: false, liveFailed: err, thinking: false } : msg
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-tour="ask-panel"
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Ask Vondera"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0d1420] p-5 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[420px] sm:rounded-none sm:border-t-0 sm:border-l">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-100">Ask Vondera</h2>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="flex min-h-[44px] items-center rounded-md px-3 py-1.5 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close the Ask panel"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-white/15 font-mono text-sm text-slate-300 hover:bg-white/5"
            >
              ✕
            </button>
          </div>
        </div>
        <p className="mb-4">
          <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-400 ring-1 ring-white/10">
            demo · answers from computed metrics
          </span>
        </p>

        {/* Live mode is unverified in this build — show exactly what the
            first live call would send, before anything leaves the browser. */}
        {enabled && apiKey && (
          <details className="mb-4 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
            <summary className="cursor-pointer font-mono text-xs font-medium text-slate-300">
              What live mode sends
            </summary>
            <p className="mt-2 text-sm text-slate-400">
              Computed metrics only — headlines, case titles, counts. Never raw rows.
            </p>
            <p className="mt-2 text-sm text-amber-300/90">
              ⚠ Live mode is unverified in this build. Answers come from the model you configured
              and are not checked against the rules engine — treat them as narration, not as a
              source of new numbers.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-xs text-slate-300">
              {JSON.stringify(buildBundle(data, snapshot), null, 2)}
            </pre>
          </details>
        )}

        {messages.length === 0 && (
          <div className="mb-4">
            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-slate-400">
              Try one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => void ask(c)}
                  className="flex min-h-[44px] items-center rounded-full bg-white/5 px-4 py-2 text-left font-mono text-xs text-slate-200 ring-1 ring-white/15 hover:bg-white/10"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i}>
              <p className="mb-1 text-right text-sm font-medium text-slate-300">{m.q}</p>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 flex items-center gap-2">
                  {m.thinking ? (
                    <span className="font-mono text-xs italic text-slate-400">thinking…</span>
                  ) : m.live ? (
                    <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/30">
                      ✨ live
                    </span>
                  ) : (
                    <span
                      className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-400 ring-1 ring-white/10"
                      title="Written from your data by deterministic rules — no model involved"
                    >
                      rules
                    </span>
                  )}
                </p>
                {m.a && <p className="text-sm leading-relaxed text-slate-200">{m.a.text}</p>}
                {m.a && (
                  <p className="mt-2 font-mono text-xs text-slate-400">
                    Answered from: {m.a.answeredFrom.join(" · ")}
                  </p>
                )}
                {m.liveFailed && (
                  <p className="mt-2 font-mono text-xs text-amber-400">
                    Live answer failed ({m.liveFailed}) — showing the rules version.
                  </p>
                )}
                {m.a && m.a.followUp.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.a.followUp.map((f) => (
                      <button
                        key={f}
                        onClick={() => void ask(f)}
                        className="flex min-h-[44px] items-center rounded-full bg-white/5 px-3 py-1.5 text-left font-mono text-xs text-cyan-300 ring-1 ring-cyan-400/20 hover:bg-white/10"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
                {m.a?.caseId && (
                  <button
                    onClick={() => {
                      onOpenCase(m.a!.caseId!);
                      onClose();
                    }}
                    className="mt-2 flex min-h-[44px] items-center font-mono text-[13px] font-medium text-cyan-300 hover:underline"
                  >
                    Open case →
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
            setInput("");
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your numbers…"
            aria-label="Ask about your numbers"
            className="min-h-[44px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="flex min-h-[44px] shrink-0 items-center rounded-md bg-cyan-400 px-4 py-2 font-mono text-sm font-bold text-slate-950 disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
