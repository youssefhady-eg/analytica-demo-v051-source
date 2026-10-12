"use client";

import { useDemoData } from "./DataProvider";
import { fmtEGP } from "@/lib/format";
import { waitingCases } from "@/lib/cases";
import { Eyebrow } from "@/components/ui";

export default function ViewHome({ onNav }: { onNav: (v: "detect" | "upload") => void }) {
  const { data, watchlist, dispositions } = useDemoData();
  const isCsv = data.source === "csv";
  // P1-01: the CTA counts what still waits — same selector as Detect.
  const nCases = waitingCases(data, watchlist, dispositions).length;
  return (
    <div className="mx-auto max-w-2xl py-14 text-center">
      <Eyebrow className="mb-3">Analytica · the Agentic Intelligence Layer</Eyebrow>
      <h1 className="mb-4 text-5xl font-bold tracking-tight text-slate-50">
        Don&apos;t read your numbers.
        <br />
        <span className="glow-cyan text-cyan-300">Work the case.</span>
      </h1>
      <p className="mb-2 text-lg text-slate-400">
        Analytica watches your profit, flags what moved, and walks you through the
        investigation — detect, isolate, diagnose, decide, verify — with an analyst
        narrating every step.
      </p>
      <p className="mb-8 text-slate-400">
        {isCsv ? (
          <>Running on your uploaded data for {data.brand.name} ({fmtEGP(data.brand.monthly_ad_spend_egp)}/mo ad spend).</>
        ) : (
          <>Showing on fictional data for {data.brand.name} ({fmtEGP(data.brand.monthly_ad_spend_egp)}/mo ad spend). Load your own CSVs anytime.</>
        )}{" "}
        Nothing here is real — it&apos;s here so you can answer one question:{" "}
        <em className="text-slate-300">would you open this every morning?</em>
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => onNav("detect")}
          className="rounded-lg bg-cyan-400 px-6 py-3 font-mono text-base font-bold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.35)] hover:bg-cyan-300"
        >
          Work a case → ({nCases} waiting)
        </button>
        {!isCsv && (
          <button
            onClick={() => onNav("upload")}
            className="rounded-lg px-6 py-3 font-mono text-base font-medium text-emerald-300 ring-1 ring-emerald-400/40 hover:bg-emerald-400/10"
          >
            ↑ Or load your CSVs
          </button>
        )}
      </div>

      <div className="mt-14 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-left">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Where Analytica sits
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-slate-400 ring-1 ring-white/10">Vondera apps · data in</span>
          <span className="text-slate-600" aria-hidden="true">→</span>
          <span className="rounded-full bg-cyan-400 px-3 py-1 font-mono text-xs font-bold text-slate-950">Analytica · intelligence</span>
          <span className="text-slate-600" aria-hidden="true">→</span>
          <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-slate-400 ring-1 ring-white/10">VPal / apps · actions out</span>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          One of Vondera&apos;s products — not an app-store listing. It diagnoses and proposes; the ecosystem executes.
        </p>
      </div>

      <p className="mt-8 font-mono text-xs text-slate-400">
        ✨ Flip the Analyst toggle (bottom right) to hear the investigation narrated live.
      </p>
    </div>
  );
}
