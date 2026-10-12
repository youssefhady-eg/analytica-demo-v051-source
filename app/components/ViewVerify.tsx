"use client";
import { useState } from "react";
import { Card, Text, Title, Eyebrow } from "@/components/ui";
import { useDemoData } from "@/components/DataProvider";
import { getCase } from "@/lib/cases";
import { narrate, narrationMetrics } from "@/lib/narrate";
import AnalystNote from "@/components/AnalystNote";
import Stepper from "@/components/Stepper";
import { fmtEGP } from "@/lib/format";

/** Step 5 — Verify. The loop most dashboards never close: did the approved
 *  action work? In the demo the watchlist is local; in production this is
 *  daily monitoring with recovery alerts. */
export default function ViewVerify({
  onDetect,
  onOpenCase,
}: {
  onDetect: () => void;
  onOpenCase: (id: string) => void;
}) {
  const { data, watchlist, unwatch } = useDemoData();
  // P1-06: unwatching is a two-step inline confirm — no modal.
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const cases = watchlist
    .map((id) => getCase(data, id))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div>
      <Eyebrow>Step 5 · Verify</Eyebrow>
      <h1 className="mb-2 mt-1 text-3xl font-bold tracking-tight text-slate-50">Did it work?</h1>
      <p className="mb-6 max-w-3xl text-slate-400">
        Every approved action lands here. In production this page watches the metric
        daily and flags you the moment it recovers — or doesn&apos;t. Trust compounds
        when the tool shows its receipts.
      </p>
      <Stepper current="verify" />

      {cases.length === 0 ? (
        <Card className="border-dashed border-white/20 p-5">
          <Title>👀 Nothing being watched yet</Title>
          <Text className="mt-2">
            Work a case from triage and approve its action — it will appear here,
            monitored until the metric recovers.
          </Text>
          <button onClick={onDetect} className="mt-4 inline-block rounded-lg bg-cyan-400 px-5 py-2.5 font-mono text-sm font-bold text-slate-950 hover:bg-cyan-300 min-h-[44px]">
            ← Back to triage
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <Card key={c.id} className="border-t-2 border-t-emerald-400 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Monitoring · approved
                  </p>
                  <Title className="mt-1">{c.title}</Title>
                  <Text className="mt-1">{c.detail}</Text>
                  {c.impactEgp !== null && (
                    <Text className="mt-2">
                      <span className="font-semibold">{fmtEGP(c.impactEgp)}/mo</span> at stake — watching for recovery over the next 14 days.
                    </Text>
                  )}
                  {/* P1-06: every card links back to its case. */}
                  <button
                    onClick={() => onOpenCase(c.id)}
                    className="mt-2 flex min-h-[44px] items-center font-mono text-[13px] font-medium text-cyan-300 hover:underline"
                  >
                    Open case →
                  </button>
                </div>
                {confirmStop === c.id ? (
                  <div className="shrink-0 rounded-lg bg-white/[0.03] p-2 text-right ring-1 ring-white/10">
                    <p className="mb-2 font-mono text-xs text-slate-300">Stop watching this case?</p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          unwatch(c.id);
                          setConfirmStop(null);
                        }}
                        className="flex min-h-[44px] items-center rounded-md bg-rose-500/15 px-3 py-1.5 font-mono text-xs font-bold text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/25"
                      >
                        Yes, stop
                      </button>
                      <button
                        onClick={() => setConfirmStop(null)}
                        className="flex min-h-[44px] items-center rounded-md border border-white/15 px-3 py-1.5 font-mono text-xs text-slate-300 hover:bg-white/5"
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmStop(c.id)}
                    className="flex min-h-[44px] shrink-0 items-center font-mono text-xs font-medium text-slate-400 hover:text-rose-400"
                  >
                    Stop watching
                  </button>
                )}
              </div>
              <div className="mt-4">
                <AnalystNote
                  stage="verify"
                  caseTitle={c.title}
                  metrics={narrationMetrics("verify", c, data)}
                  rulesText={narrate("verify", c, data)}
                />
              </div>
              <Text className="mt-3 font-mono text-xs italic">
                Demo: the watchlist is local and the recovery feed is illustrative. In production this is daily monitoring — the metric, the action taken, and the outcome, side by side.
              </Text>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
