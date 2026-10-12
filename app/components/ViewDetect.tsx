"use client";
import { Card, Metric, Text, Title, Eyebrow } from "@/components/ui";
import { useDemoData, type Disposition } from "@/components/DataProvider";
import { useTour } from "@/components/TourProvider";
import { buildCases, detectorStatus, getCase, snapshotLabel, waitingCases } from "@/lib/cases";
import { narrate, narrationMetrics, type Stage } from "@/lib/narrate";
import AnalystNote from "@/components/AnalystNote";
import Stepper from "@/components/Stepper";
import { fmtEGP, fmtX } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  "roas-drop": "ROAS drop",
  "funnel-leak": "Funnel leak",
  "money-offender": "Profit lie",
};

const KIND_ACCENT: Record<string, string> = {
  "roas-drop": "border-cyan-400/30",
  "funnel-leak": "border-amber-400/30",
  "money-offender": "border-rose-500/40",
};

/** P2 §7.3: a snoozed case the numbers brought back. */
function isResurfaced(dispositions: Record<string, Disposition>, id: string): boolean {
  const d = dispositions[id];
  return d !== undefined && d.kind === "snoozed" && d.resurfaced === true;
}

export default function ViewDetect({
  onOpenCase,
  onVerify,
  onUpload,
}: {
  onOpenCase: (id: string) => void;
  onVerify: () => void;
  onUpload: () => void;
}) {
  const { data, watchlist, dispositions, undoDisposition, simulateWorsening } = useDemoData();
  // Phase 4: the tour pre-expands this log and hides demo controls in Clean view.
  const tour = useTour();
  const expandLog = tour.expandLog;
  const showSimulate = !tour.hideDemoControls || tour.step?.needsDemoControls === true;
  const { adsets } = data;
  const cases = buildCases(data);
  // P1-01 + P2: rank and number only what still waits — one selector, shared
  // with Home. Snoozed-then-worsened cases wait again (§7.3).
  const waiting = waitingCases(data, watchlist, dispositions);
  const watched = watchlist.length;
  // P2 §7.4: the handled log — dispositions whose case still exists.
  const handled = Object.entries(dispositions)
    .map(([id, disp]) => ({ id, disp, c: getCase(data, id) }))
    .filter((r): r is { id: string; disp: Disposition; c: NonNullable<ReturnType<typeof getCase>> } => r.c !== null)
    .filter((r) => !(r.disp.kind === "snoozed" && r.disp.resurfaced));
  // P2 §7.7: overrides reach the Analyst note and the live metrics.
  const overrideList = handled
    .filter((r) => r.disp.kind === "override")
    .map((r) => ({ case_kind: r.c.kind, case_title: r.c.title }));
  const snoozedCount = handled.filter((r) => r.disp.kind === "snoozed").length;
  // P1-02: never claim quiet for a check that didn't run.
  const status = detectorStatus(data);
  const skipped: { label: string; reason: string; file: string }[] = [
    ...(status.roasDrop.status === "skipped"
      ? [{ label: "ROAS-drop scan", reason: status.roasDrop.reason ?? "", file: "daily_adset.csv" }]
      : []),
    ...(status.funnel.status === "skipped"
      ? [{ label: "Funnel-leak scan", reason: status.funnel.reason ?? "", file: "funnel.csv" }]
      : []),
    ...(status.adLinkage.status === "skipped"
      ? [{
          label: "Per-ad profit",
          reason: status.adLinkage.reason ?? "",
          file: !data.hasAds ? "ads.csv" : "orders.csv",
        }]
      : []),
  ];
  // All-quiet copy names only the checks that ran (money offenders always scan).
  const calmParts = [
    ...(status.roasDrop.status === "ran" ? ["no sharp ROAS drops"] : []),
    ...(status.funnel.status === "ran" ? ["no active funnel leaks"] : []),
    "no ad set losing money behind a pretty ROAS",
  ];
  const calmText = `${calmParts[0].charAt(0).toUpperCase()}${calmParts[0].slice(1)}${calmParts.length > 1 ? `, ${calmParts.slice(1).join(", ")}` : ""}. This feed lights up the moment something moves.`;

  const totalSpend = adsets.reduce((s, a) => s + a.spend_egp, 0);
  const totalProfit = adsets.reduce((s, a) => s + a.profit_egp, 0);
  const blendedRoas = totalSpend
    ? adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / totalSpend
    : 0;
  const blendedPoas = totalSpend ? totalProfit / totalSpend : 0;

  const stage: Stage = "detect";

  return (
    <div>
      <Eyebrow>Mission control · triage</Eyebrow>
      <h1 className="mb-2 mt-1 text-3xl font-bold tracking-tight text-slate-50">
        Where to focus
      </h1>
      <p className="mb-6 max-w-3xl text-slate-400">
        Everything that moved enough to matter, ranked by money — detected by Analytica
        and submitted by your marketers. Start at the top.
      </p>
      <Stepper current={stage} />

      <div data-tour="detect-hooks" className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <Text>Blended platform ROAS</Text>
          <Metric className="mt-1">{fmtX(blendedRoas)}</Metric>
          <Text className="mt-1 text-xs">What the dashboard claims</Text>
        </Card>
        <Card className="p-5">
          <Text>True profit POAS</Text>
          <Metric className="glow-money mt-1 text-emerald-300">{fmtX(blendedPoas)}</Metric>
          <Text className="mt-1 text-xs">Profit ÷ ad spend, after costs</Text>
        </Card>
        <Card className="border-rose-500/30 p-5">
          <Text>Overstatement</Text>
          <Metric className="mt-1 text-rose-400" >
            <span style={{ textShadow: "0 0 24px rgba(251,113,133,0.35)" }}>
              {fmtX(blendedPoas ? blendedRoas / blendedPoas : 0)}
            </span>
          </Metric>
          <Text className="mt-1 text-xs">The platform&apos;s number is this far off</Text>
        </Card>
      </div>

      {skipped.length > 0 && (
        <Card className="mb-6 border-amber-400/30 bg-amber-400/[0.05] p-5">
          <Title className="text-amber-300">Some checks couldn&apos;t run</Title>
          <ul className="mt-2 space-y-2">
            {skipped.map((s) => (
              <li key={s.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-amber-200">
                <span>
                  <span className="font-semibold">{s.label}</span> skipped — {s.reason}.
                </span>
                <button
                  onClick={onUpload}
                  className="flex min-h-[44px] items-center font-mono text-[13px] font-medium text-emerald-300 hover:underline"
                >
                  ↑ Load {s.file}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {waiting.length === 0 && cases.length > 0 ? (
        <Card className="border-cyan-400/30 p-5">
          <Title>All cases handled</Title>
          <Text className="mt-2">
            Nothing left waiting — every case is on the watchlist or resolved. New movement will land here.
          </Text>
          <button onClick={onVerify} className="mt-4 inline-block rounded-lg bg-cyan-400 px-5 py-2.5 font-mono text-sm font-bold text-slate-950 hover:bg-cyan-300 min-h-[44px]">
            Open the watchlist →
          </button>
        </Card>
      ) : cases.length === 0 ? (
        <Card className="border-emerald-400/30 p-5">
          <Title>✅ All quiet</Title>
          <Text className="mt-2">
            {calmText}
          </Text>
        </Card>
      ) : (
        <div data-tour="detect-list" className="space-y-3">
          {waiting.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onOpenCase(c.id)}
              // P3-03: below sm the money row stacks under the copy; the whole
              // card stays one tap target.
              className={`group flex w-full flex-col gap-3 rounded-xl border bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${KIND_ACCENT[c.kind]} ${
                i === 0 ? "ring-1 ring-cyan-400/50" : ""
              }`}
            >
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
                    i === 0
                      ? "bg-cyan-400 text-slate-950"
                      : "bg-white/5 text-slate-300 ring-1 ring-white/10"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="mb-1 flex flex-wrap items-center gap-2">
                    {i === 0 && (
                      <span className="rounded-full bg-cyan-400 px-2 py-0.5 font-mono text-xs font-bold text-slate-950">
                        START HERE
                      </span>
                    )}
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                      {KIND_LABEL[c.kind]}
                    </span>
                    {c.source === "submitted" ? (
                      <span className="rounded-full bg-amber-400/10 px-2 py-0.5 font-mono text-xs text-amber-300 ring-1 ring-amber-400/30">
                        ✉ from {c.submittedBy?.split("·")[0].trim()}
                      </span>
                    ) : (
                      <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 font-mono text-xs text-cyan-300 ring-1 ring-cyan-400/30">
                        ◉ detected
                      </span>
                    )}
                  </p>
                  <p className="font-semibold text-slate-100">{c.title}</p>
                  <p className="text-sm text-slate-400">{c.detail}</p>
                  {c.submitterNote && (
                    <p className="mt-1 border-l-2 border-amber-400/40 pl-2 text-sm italic text-slate-400">
                      “{c.submitterNote}”
                    </p>
                  )}
                  {isResurfaced(dispositions, c.id) && (
                    <>
                      <p className="mt-1 font-mono text-xs font-semibold text-cyan-300">
                        ↻ Re-surfaced — worsened since snoozed
                      </p>
                      <p className="mt-1 text-sm italic text-slate-400">
                        I brought this back — it&apos;s worse than when you snoozed it.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <span className="flex shrink-0 items-center justify-between gap-3 text-right sm:block">
                {c.impactEgp !== null ? (
                  <span className="glow-money block font-mono text-xl font-bold tabular-nums text-emerald-300">
                    {fmtEGP(c.impactEgp)}
                  </span>
                ) : (
                  <span className="block font-mono text-xs font-medium text-slate-400">
                    impact not sized
                  </span>
                )}
                <span className="font-mono text-[13px] font-medium text-cyan-300 group-hover:underline">
                  Work it →
                </span>
              </span>
            </button>
          ))}
          {watched > 0 && (
            <button onClick={onVerify} className="flex min-h-[44px] items-center font-mono text-[13px] font-medium text-slate-400 hover:text-cyan-300">
              {watched} on the watchlist →
            </button>
          )}
        </div>
      )}

      <div className="mt-8">
        <AnalystNote
          stage={stage}
          caseTitle="morning triage"
          tourId="detect-analyst"
          metrics={{
            ...narrationMetrics(stage, waiting[0] ?? cases[0] ?? { id: "none", kind: "roas-drop", title: "triage", detail: "", impactEgp: null, adsetId: null, channel: null, stepIdx: null, source: "detected" }, data),
            human_overrides: overrideList,
            snoozed_count: snoozedCount,
          }}
          rulesText={
            waiting.length > 0
              ? `I scanned everything overnight and took in ${waiting.filter((c) => c.source === "submitted").length} submitted case${waiting.filter((c) => c.source === "submitted").length === 1 ? "" : "s"} from your marketers: ${waiting.length} thing${waiting.length > 1 ? "s" : ""} need attention. Start at the top — it's ranked by money, not by noise.${overrideList.length > 0 ? ` You've overridden ${overrideList.length} of my reads — I've logged them.` : ""}`
              : cases.length > 0
                ? `Every case is handled — the watchlist has them. I'll flag you the moment something new moves.${overrideList.length > 0 ? ` You've overridden ${overrideList.length} of my reads — I've logged them.` : ""}`
                : "I scanned everything overnight and nothing moved enough to matter. Enjoy the quiet — I'll flag you the moment that changes."
          }
        />
      </div>

      {handled.length > 0 && (
        <details
          data-tour="handled-log"
          open={expandLog ? true : undefined}
          className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            Handled & snoozed ({handled.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {handled.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5"
              >
                <button
                  onClick={() => onOpenCase(r.id)}
                  className="text-left font-semibold text-slate-200 hover:text-cyan-300 hover:underline"
                >
                  {r.c.title}
                </button>
                {r.disp.kind === "resolved" && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-400 ring-1 ring-white/10">
                    resolved
                  </span>
                )}
                {r.disp.kind === "snoozed" && (
                  <>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-400 ring-1 ring-white/10">
                      snoozed
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {snapshotLabel(r.disp.snapshot)} at snooze
                    </span>
                    {showSimulate && (
                    <button
                      onClick={() => simulateWorsening(r.id)}
                      className="flex min-h-[44px] items-center font-mono text-xs text-slate-400 underline decoration-dotted hover:text-cyan-300"
                      title="Demo control: pretend the tracked metric slipped, to show re-surfacing"
                    >
                      Simulate worsening (demo)
                    </button>
                    )}
                  </>
                )}
                {r.disp.kind === "override" && (
                  <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 font-mono text-xs text-cyan-300 ring-1 ring-cyan-400/30">
                    your override
                  </span>
                )}
                <button
                  onClick={() => undoDisposition(r.id)}
                  className="ml-auto flex min-h-[44px] items-center font-mono text-xs font-medium text-slate-400 hover:text-cyan-300"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-xs text-slate-400">
            Demo: overrides are kept in this page only. In production they feed the intelligence layer as training signal.
          </p>
        </details>
      )}

      <details className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          How the true number is computed (assumptions)
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
          {data.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-xs text-slate-400">
          {data.brand.name} · {fmtEGP(data.brand.monthly_ad_spend_egp)}/mo ad spend · figures{" "}
          {data.source === "csv" ? "computed from your uploaded CSVs" : "fictional, generated for demo purposes"}
        </p>
      </details>
    </div>
  );
}
