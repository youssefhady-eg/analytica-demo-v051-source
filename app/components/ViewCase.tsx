"use client";

import { useEffect, useState } from "react";
import { Card, Text, Title, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Eyebrow } from "@/components/ui";
import { useDemoData, type DismissReason, type Disposition } from "@/components/DataProvider";
import { useTour } from "@/components/TourProvider";
import { getCase, evidenceLayers, casePlan, type CaseItem } from "@/lib/cases";
import { narrate, narrationMetrics, type Stage } from "@/lib/narrate";
import { detectRoasDrop } from "@/lib/diagnose";
import { STAGE_KEY, stepLabel, channelLabel } from "@/lib/funnel";
import AnalystNote from "@/components/AnalystNote";
import Stepper from "@/components/Stepper";
import TrendChart from "@/components/TrendChart";
import FunnelChart from "@/components/FunnelChart";
import AdTable from "@/components/AdTable";
import { fmtEGP, fmtX } from "@/lib/format";

const FLOW: Stage[] = ["isolate", "diagnose", "decide"];

const KIND_LABEL: Record<string, string> = {
  "roas-drop": "ROAS drop",
  "funnel-leak": "Funnel leak",
  "money-offender": "Profit lie",
};

/** P3-10: stage transitions scroll instantly for reduced-motion users. */
function scrollTop() {
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

export default function ViewCase({
  caseId,
  onBack,
  onVerify,
  onUpload,
}: {
  caseId: string;
  onBack: () => void;
  onVerify: () => void;
  onUpload: () => void;
}) {
  const { data, watch, watchlist, dispositions, undoDisposition } = useDemoData();
  const c = getCase(data, caseId);
  const [stage, setStage] = useState<Stage>("isolate");
  const [revealed, setRevealed] = useState(1);
  const [decided, setDecided] = useState(false);
  // Phase 4: the tour drives the stage when this case is open (hooks stay
  // above the early return; the tour is inert when inactive).
  const tour = useTour();
  useEffect(() => {
    const s = tour.active ? tour.step : null;
    if (s && c && typeof s.view !== "string" && s.view.case === c.id && s.stage) {
      setStage(s.stage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.active, tour.step, c?.id]);

  if (!c) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <Title>Case not found</Title>
        <Text className="mt-2">It may have cleared — or the dataset changed.</Text>
        <button onClick={onBack} className="mt-4 inline-block rounded-lg bg-cyan-400 px-5 py-2.5 font-mono text-sm font-bold text-slate-950 min-h-[44px]">
          ← Back to triage
        </button>
      </div>
    );
  }

  const goStage = (s: Stage) => {
    // P1-03: every clickable pill routes somewhere — Detect backs out to
    // triage; Verify (only clickable once approved) opens the watchlist.
    if (s === "detect") {
      onBack();
      return;
    }
    if (s === "verify") {
      if (decided || watchlist.includes(c.id)) onVerify();
      return;
    }
    setStage(s);
    scrollTop();
  };
  const next = () => {
    const i = FLOW.indexOf(stage);
    if (i < FLOW.length - 1) {
      setStage(FLOW[i + 1]);
      scrollTop();
    }
  };
  const back = () => {
    const i = FLOW.indexOf(stage);
    if (i > 0) {
      setStage(FLOW[i - 1]);
      scrollTop();
    }
  };

  const onApprove = () => {
    watch(c.id);
    // P2 §7.8: approving clears any disposition (e.g. a snooze) — the case
    // goes to the watchlist exactly once.
    undoDisposition(c.id);
    setDecided(true);
  };
  const isWatching = decided || watchlist.includes(c.id);
  // P1-04: the Diagnose note follows the peel — needs the layer count here.
  const layers = evidenceLayers(c, data);
  // P2 §7.7: an override follows the case into Decide.
  const isOverride = dispositions[c.id]?.kind === "override";
  // Phase 4: the tour drives the real case — stage follows the step when this
  // case is open; layers peel on arrival. Untouched when no tour is active.
  const tourStep = tour.active ? tour.step : null;
  const tourHere =
    tourStep && typeof tourStep.view !== "string" && tourStep.view.case === c.id
      ? tourStep
      : null;
  const shownRevealed = tourHere?.revealLayers ? layers.length : revealed;

  return (
    <div className="pb-24 md:pb-0">
      <button onClick={onBack} className="flex min-h-[44px] items-center font-mono text-[13px] font-medium text-cyan-300 hover:underline">
        ← Triage
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Eyebrow>
          {KIND_LABEL[c.kind]} · {stageLabel(stage)}
        </Eyebrow>
        {c.source === "submitted" ? (
          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 font-mono text-xs text-amber-300 ring-1 ring-amber-400/30">
            ✉ submitted by {c.submittedBy}
          </span>
        ) : (
          <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 font-mono text-xs text-cyan-300 ring-1 ring-cyan-400/30">
            ◉ detected by Analytica
          </span>
        )}
      </div>
      <h1 className="mb-4 mt-1 text-3xl font-bold tracking-tight text-slate-50">{c.title}</h1>
      {c.submitterNote && (
        <p className="mb-4 border-l-2 border-amber-400/40 pl-3 italic text-slate-400">
          “{c.submitterNote}”
        </p>
      )}

      <Stepper
        current={stage}
        onGo={goStage}
        allowVerify={isWatching}
      />
      <div className="mb-6 flex justify-end">
        <button onClick={onVerify} className="flex min-h-[44px] items-center font-mono text-[13px] font-medium text-slate-400 hover:text-cyan-300">
          Watchlist ({watchlist.length}) →
        </button>
      </div>

      <div className="mb-6">
        <AnalystNote
          stage={stage}
          caseTitle={c.title}
          metrics={
            stage === "diagnose"
              ? narrationMetrics(stage, c, data, { revealed: shownRevealed, totalLayers: layers.length })
              : narrationMetrics(stage, c, data)
          }
          rulesText={
            stage === "diagnose"
              ? narrate(stage, c, data, { revealed: shownRevealed, totalLayers: layers.length })
              : stage === "decide"
                ? narrate(stage, c, data, { approved: isWatching, override: isOverride })
                : narrate(stage, c, data)
          }
        />
      </div>

      {stage === "isolate" && <IsolateStage c={c} onUpload={onUpload} onBack={onBack} />}
      {stage === "diagnose" && (
        <DiagnoseStage c={c} revealed={shownRevealed} setRevealed={setRevealed} />
      )}
      {stage === "decide" && (
        <DecideStage c={c} isWatching={isWatching} onApprove={onApprove} onBack={onBack} />
      )}

      {/* P3-04: below md the Back/Next row docks as a sticky bottom action
          bar (safe-area aware); from md up it is the plain inline row. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0f18]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:z-auto md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        {FLOW.indexOf(stage) > 0 ? (
          <button onClick={back} className="flex min-h-[44px] items-center rounded-lg border border-white/15 px-5 py-2.5 font-mono text-sm font-medium text-slate-300 hover:bg-white/5">
            ← Back
          </button>
        ) : <span />}
        {FLOW.indexOf(stage) < FLOW.length - 1 ? (
          <button onClick={next} className="flex min-h-[44px] items-center rounded-lg bg-cyan-400 px-5 py-2.5 font-mono text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:bg-cyan-300">
            {stage === "isolate" ? "Diagnose →" : "Decide →"}
          </button>
        ) : isWatching ? (
          <button onClick={onVerify} className="flex min-h-[44px] items-center rounded-lg bg-emerald-400 px-5 py-2.5 font-mono text-sm font-bold text-slate-950 hover:bg-emerald-300">
            Open the watchlist →
          </button>
        ) : <span />}
        </div>
      </div>
    </div>
  );
}

function stageLabel(s: Stage): string {
  return { detect: "Detect", isolate: "Isolate", diagnose: "Diagnose", decide: "Decide", verify: "Verify" }[s];
}

function IsolateStage({ c, onUpload, onBack }: { c: CaseItem; onUpload: () => void; onBack: () => void }) {
  const { data } = useDemoData();
  return (
    <div data-tour="isolate-evidence" className="space-y-6">
      {c.kind === "roas-drop" && c.adsetId && (
        <>
          <Card className="p-5">
            <TrendChart
              rows={data.daily.filter((r) => r.adset_id === c.adsetId)}
              title={`${data.adsets.find((a) => a.id === c.adsetId)?.name ?? ""} — daily trend`}
            />
          </Card>
          <AdTable adsetId={c.adsetId} onUpload={onUpload} />
        </>
      )}
      {c.kind === "funnel-leak" && c.channel && (
        <Card className="p-5">
          <FunnelChart funnel={data.funnel} channel={c.channel} title={`${channelLabel(c.channel)} — funnel`} />
          <Text className="mt-2">
            The bleed is at <span className="font-semibold text-slate-200">{stepLabel((c.stepIdx ?? 1) - 1)} → {stepLabel(c.stepIdx ?? 1)}</span>. The other steps hold.
          </Text>
        </Card>
      )}
      {c.kind === "money-offender" && c.adsetId && (
        <>
          <MarginDecomposition adsetId={c.adsetId} />
          <Card className="p-5">
            <Title>Their number vs the true number</Title>
            <p className="mb-1 mt-3 text-right font-mono text-xs text-slate-400 sm:hidden" aria-hidden="true">
              scroll →
            </p>
            <Table className="sticky-first min-w-[560px]">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Ad set</TableHeaderCell>
                  <TableHeaderCell>Spend</TableHeaderCell>
                  <TableHeaderCell>Platform ROAS</TableHeaderCell>
                  <TableHeaderCell>True POAS</TableHeaderCell>
                  <TableHeaderCell>Gap</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...data.adsets].sort((a, b) => b.gap - a.gap).map((a) => (
                  <TableRow key={a.id} className={a.id === c.adsetId ? "bg-rose-500/10" : ""}>
                    <TableCell className="font-medium text-slate-200">{a.name}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtEGP(a.spend_egp)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtX(a.platform_roas)}</TableCell>
                    <TableCell className={a.true_poas < 1 ? "font-mono font-semibold tabular-nums text-rose-400" : "font-mono tabular-nums"}>{fmtX(a.true_poas)}</TableCell>
                    <TableCell className="font-mono font-semibold tabular-nums text-rose-400">+{a.gap.toFixed(2)}×</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <AdTable adsetId={c.adsetId} onUpload={onUpload} />
        </>
      )}
      {/* P1-07: quiet way back — forward momentum stays primary. */}
      <div>
        <button onClick={onBack} className="flex min-h-[44px] items-center font-mono text-[13px] text-slate-400 hover:text-cyan-300 hover:underline">
          ← Back to triage
        </button>
      </div>
    </div>
  );
}

/** P1-09: margin decomposition for Profit-lie cases — revenue → COGS →
 *  shipping → failed-delivery burn → profit, every figure from economics. */
function MarginDecomposition({ adsetId }: { adsetId: string }) {
  const { data } = useDemoData();
  const a = data.adsets.find((x) => x.id === adsetId);
  if (!a) return null;
  const e = a.economics;
  const revenue = e.revenue_egp;
  const profit = revenue - e.cogs_egp - e.ship_egp - e.failed_egp;
  const segs = [
    { label: "COGS", value: e.cogs_egp, cls: "bg-slate-400" },
    { label: "Shipping", value: e.ship_egp, cls: "bg-cyan-400" },
    { label: "Failed-delivery burn", value: e.failed_egp, cls: "bg-rose-500" },
    { label: "Profit", value: profit, cls: "bg-emerald-400" },
  ];
  return (
    <Card className="p-5">
      <Title>Where the margin goes</Title>
      <Text className="mt-1">
        {a.name} turns {fmtEGP(revenue)} of revenue into {fmtEGP(profit)} of profit on {fmtEGP(a.spend_egp)} of spend — true POAS {fmtX(a.true_poas)}.
      </Text>
      <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full ring-1 ring-white/10">
        {segs.map((s) => (
          <div
            key={s.label}
            className={s.cls}
            style={{ width: `${revenue > 0 ? (Math.max(0, s.value) / revenue) * 100 : 0}%` }}
            title={`${s.label}: ${fmtEGP(s.value)}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {segs.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${s.cls}`} />
            <span className="text-slate-400">{i === segs.length - 1 ? "= " : ""}{s.label}</span>
            <span className="ml-auto font-mono tabular-nums text-slate-200">{fmtEGP(s.value)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const SOURCE_STYLE: Record<string, string> = {
  data: "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30",
  inspection: "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30",
  input: "bg-white/5 text-slate-400 ring-1 ring-white/10",
};

function DiagnoseStage({ c, revealed, setRevealed }: { c: CaseItem; revealed: number; setRevealed: (n: number) => void }) {
  const { data } = useDemoData();
  const layers = evidenceLayers(c, data);
  const allRevealed = revealed >= layers.length;

  const gapStage = (() => {
    if (c.kind !== "funnel-leak" || c.stepIdx === null) return null;
    const key = STAGE_KEY[`${["session", "add_to_cart", "checkout", "purchase"][c.stepIdx - 1]}>${["session", "add_to_cart", "checkout", "purchase"][c.stepIdx]}`];
    return key ? data.gaps.stages[key] : null;
  })();

  const rc = c.kind === "roas-drop" ? detectRoasDrop(data) : null;

  return (
    <div data-tour="diagnose-layers" className="space-y-4">
      {layers.slice(0, revealed).map((l, i) => (
        <Card key={i} className={`border-l-2 p-5 ${l.verdict === "ok" ? "border-l-emerald-400" : "border-l-rose-500"}`}>
          <p className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold ${l.verdict === "ok" ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/40"}`}>
              {l.verdict === "ok" ? "OK" : "PROBLEM"}
            </span>
          </p>
          <Title className="mt-1 text-base">{l.title}</Title>
          <Text className="mt-1">{l.text}</Text>
        </Card>
      ))}
      {!allRevealed && (
        <button
          onClick={() => setRevealed(revealed + 1)}
          className="w-full rounded-xl border-2 border-dashed border-cyan-400/40 bg-cyan-400/[0.04] px-5 py-4 font-mono text-sm font-medium text-cyan-300 hover:bg-cyan-400/[0.08]"
        >
          ↓ Peel the next layer ({revealed}/{layers.length})
        </button>
      )}

      {allRevealed && (
        <>
          {rc?.culprit && (
            <Card className="border-rose-500/40 bg-rose-500/[0.06] p-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">Culprit · rules-detected</p>
              <Title className="mt-1">{rc.culprit.ad_name}</Title>
              <Text className="mt-2">
                {rc.culpritFlags.join(" + ").toLowerCase()} — at {rc.culprit.poas.toFixed(2)}× profit POAS, the ad set&apos;s worst earner.
              </Text>
            </Card>
          )}
          {gapStage && (
            <Card className="p-5">
              <Title>Likely causes — {gapStage.label} <span className="text-xs font-normal text-slate-400">(heuristic)</span></Title>
              <Text className="mt-1">{gapStage.likely_meaning}</Text>
              <ul className="mt-4 space-y-3">
                {gapStage.checklist.map((item) => (
                  <li key={item.gap} className="flex items-start gap-3 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${SOURCE_STYLE[item.source]}`}>
                      {item.source}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{item.gap}</p>
                      <p className="text-sm text-slate-400">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/[0.05] p-3">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Recover now</p>
                  <p className="mt-1 text-sm text-slate-300">{gapStage.recover}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fix the cause</p>
                  <p className="mt-1 text-sm text-slate-300">{gapStage.fix_cause}</p>
                </div>
              </div>
              <Text className="mt-3 text-xs">
                Heuristic checklist — the data pinpoints <em>where</em> the leak is; confirming <em>which</em> cause is real takes a look.
              </Text>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const DISMISS_REASONS: { reason: DismissReason; label: string }[] = [
  { reason: "already-handled", label: "Already handled" },
  { reason: "not-now", label: "Not now" },
  { reason: "disagree", label: "Disagree" },
];

/** P2 §7.6: confirmation sentences — rules narration style, casual. */
function dismissSentence(reason: DismissReason): string {
  if (reason === "already-handled") return "Marked as handled — it's out of your triage list.";
  if (reason === "not-now") return "Snoozed. I'll bring it back if the numbers get worse.";
  return "Noted — I've logged that you disagree with my read on this one.";
}

/** P2 §7.5: plan status pills — existing pill classes reused. */
function planPill(isWatching: boolean, disp: Disposition | undefined): { text: string; cls: string } {
  if (isWatching) return { text: "APPROVED · WATCHING", cls: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40" };
  if (!disp) return { text: "PENDING APPROVAL", cls: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40" };
  if (disp.kind === "resolved") return { text: "RESOLVED", cls: "bg-white/5 text-slate-400 ring-1 ring-white/15" };
  if (disp.kind === "snoozed") return { text: "SNOOZED", cls: "bg-white/5 text-slate-400 ring-1 ring-white/15" };
  return { text: "OVERRIDE LOGGED", cls: "bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/30" };
}

function DecideStage({
  c,
  isWatching,
  onApprove,
  onBack,
}: {
  c: CaseItem;
  isWatching: boolean;
  onApprove: () => void;
  onBack: () => void;
}) {
  const { data, dispositions, dismiss, undoDisposition } = useDemoData();
  // P2 §7.1: the "asking" row is local UI state; the committed dismissal
  // lives in the provider so it survives Back/Next and re-entry (§7.8).
  const [asking, setAsking] = useState(false);
  const plan = casePlan(c, data);
  const disp = dispositions[c.id];
  const pill = planPill(isWatching, disp);

  return (
    <div className="space-y-4">
      <div data-tour="decide-plan" className="rounded-xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/[0.06] to-transparent p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
            Action plan — where to focus
          </h3>
          <span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${pill.cls}`}>
            {pill.text}
          </span>
        </div>
        <ol className="space-y-3">
          {plan.map((s, i) => (
            <li key={i} className="flex items-start gap-4 rounded-lg bg-white/[0.03] p-4 ring-1 ring-white/5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 font-mono text-sm font-bold text-slate-950">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-slate-100">{s.title}</p>
                <p className="mt-0.5 text-sm text-slate-400">{s.detail}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-400 ring-1 ring-white/10">
                {s.when}
              </span>
            </li>
          ))}
        </ol>
        {!isWatching && !disp && !asking && (
          <div className="mt-4 flex gap-2">
            <button onClick={onApprove} className="flex min-h-[44px] items-center rounded-md bg-cyan-400 px-4 py-2 font-mono text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:bg-cyan-300">
              Approve plan
            </button>
            <button onClick={() => setAsking(true)} className="flex min-h-[44px] items-center rounded-md border border-white/15 px-4 py-2 font-mono text-sm font-medium text-slate-300 hover:bg-white/5">
              Dismiss
            </button>
          </div>
        )}
        {!isWatching && !disp && asking && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-slate-300">Why dismiss?</span>
            {DISMISS_REASONS.map((r) => (
              <button
                key={r.reason}
                onClick={() => {
                  dismiss(c.id, r.reason);
                  setAsking(false);
                }}
                className="flex min-h-[44px] items-center rounded-full bg-white/5 px-4 py-2 font-mono text-sm font-medium text-slate-200 ring-1 ring-white/15 hover:bg-white/10"
              >
                {r.label}
              </button>
            ))}
            <button onClick={() => setAsking(false)} className="flex min-h-[44px] items-center px-2 py-2 font-mono text-sm text-slate-400 hover:text-slate-300">
              Cancel
            </button>
          </div>
        )}
        {!isWatching && disp && (
          <div className="mt-4">
            <p className="text-sm text-slate-200">{dismissSentence(disp.reason)}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => undoDisposition(c.id)} className="flex min-h-[44px] items-center rounded-md border border-white/15 px-4 py-2 font-mono text-sm font-medium text-slate-300 hover:bg-white/5">
                Undo
              </button>
              <button onClick={onBack} className="flex min-h-[44px] items-center rounded-md px-4 py-2 font-mono text-sm font-medium text-cyan-300 hover:underline">
                ← Back to triage
              </button>
            </div>
          </div>
        )}
        {isWatching && (
          <p className="mt-4 text-sm text-emerald-300">
            Approved — this case is on the watchlist. In production the plan would execute now and I&apos;d track the recovery.
          </p>
        )}
        <p className="mt-3 font-mono text-xs text-slate-400">
          Demo: approval is recorded locally. In production this queues the actions for execution via the ecosystem (VPal / apps).
        </p>
      </div>
    </div>
  );
}
