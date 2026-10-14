"use client";

import { useEffect, useState } from "react";
import { useAnalyst } from "./AnalystProvider";
import type { Stage } from "@/lib/narrate";

/**
 * The Analyst's voice at a pipeline stage.
 *  - Toggle off (default): deterministic rules narration from computed data.
 *  - Toggle on: the same step re-verbalized live by the model.
 * Falls back to the rules version on any failure, and says so.
 */
export default function AnalystNote({
  stage,
  caseTitle,
  metrics,
  rulesText,
  tourId,
}: {
  stage: Stage;
  caseTitle: string;
  metrics: Record<string, unknown>;
  rulesText: string;
  /** Phase 4: spotlight target id (rendered as data-tour when set). */
  tourId?: string;
}) {
  const { enabled, apiKey, narrate, busy } = useAnalyst();
  const [liveText, setLiveText] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Reset the live result when the stage/inputs change, then fetch. Clearing
    // state at the start of an async effect is the intended pattern; the rule
    // flags it as a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveText(null);
    setLiveError(null);
    if (enabled && apiKey) {
      narrate(stage, caseTitle, metrics)
        .then((t) => {
          if (!cancelled) setLiveText(t);
        })
        .catch((e: Error) => {
          if (!cancelled) setLiveError(e.message);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, apiKey, stage, caseTitle, JSON.stringify(metrics)]);

  const live = enabled && liveText;

  return (
    <div
      data-tour={tourId}
      className="relative overflow-hidden rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.07] to-transparent p-5"
    >
      <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-cyan-300 to-cyan-600" />
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${live ? "bg-cyan-300 pulse-dot" : "bg-emerald-400"}`}
        />
        <span className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
          Analyst
        </span>
        {live ? (
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
      </div>
      {enabled && busy && !liveText ? (
        <p className="text-sm italic text-slate-400">Working the case…</p>
      ) : (
        <div aria-live="polite">
          <p className="text-[15px] leading-relaxed text-slate-200">{liveText ?? rulesText}</p>
        </div>
      )}
      {enabled && liveError && !liveText && (
        <p className="mt-2 font-mono text-xs text-amber-400">
          Live narration failed ({liveError}) — showing the rules version.
        </p>
      )}
    </div>
  );
}
