"use client";

import type { Stage } from "@/lib/narrate";

const STAGES: { id: Stage; label: string }[] = [
  { id: "detect", label: "Detect" },
  { id: "isolate", label: "Isolate" },
  { id: "diagnose", label: "Diagnose" },
  { id: "decide", label: "Decide" },
  { id: "verify", label: "Verify" },
];

/** The investigation pipeline, always visible — the marketer knows where they are in the case. */
export default function Stepper({
  current,
  onGo,
  allowVerify,
}: {
  current: Stage;
  onGo?: (s: Stage) => void;
  /** P1-03: the Verify pill stays non-interactive until the case is approved. */
  allowVerify?: boolean;
}) {
  const idx = STAGES.findIndex((s) => s.id === current);
  return (
    <>
      {/* P3-02: below sm a compact status bar — display only, tapping opens nothing. */}
      <div className="mb-6 sm:hidden" role="status" aria-label={`Step ${idx + 1} of ${STAGES.length}: ${STAGES[idx]?.label ?? current}`}>
        <p className="mb-2 font-mono text-xs font-medium text-slate-300">
          Step {idx + 1} of {STAGES.length} · {STAGES[idx]?.label ?? current}
        </p>
        <div className="flex gap-1" aria-hidden="true">
          {STAGES.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-cyan-400" : "bg-white/10"}`}
            />
          ))}
        </div>
      </div>
      <ol className="mb-6 hidden flex-wrap items-center gap-1 sm:flex">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const cls = active
          ? "bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          : done
            ? "bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/30"
            : "bg-white/[0.03] text-slate-400 ring-1 ring-white/10";        const inner = (
          <span className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[13px] font-medium ${cls}`}>
            <span className="text-xs opacity-70">{i + 1}</span> {s.label}
          </span>
        );
        // P1-03: no clickable pill may be a no-op. Past/active pills route via
        // onGo; Verify stays a (non-interactive) status display until approval.
        const canGo = s.id === "verify" ? !!allowVerify : done || active;
        return (
          <li key={s.id} className="flex items-center gap-1">
            {onGo && canGo ? (
              <button onClick={() => onGo(s.id)} className="flex min-h-[44px] items-center">{inner}</button>
            ) : (
              inner
            )}
            {i < STAGES.length - 1 && <span className="text-slate-600" aria-hidden="true">→</span>}
          </li>
        );
      })}
    </ol>
    </>
  );
}
