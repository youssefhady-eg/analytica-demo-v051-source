"use client";

import { useDemoData } from "./DataProvider";

/** Data-source badge: sample vs merchant CSV. Replaces the static badge. */
export default function DataBadge() {
  const { data, resetSample } = useDemoData();
  const isCsv = data.source === "csv";
  return (
    <div className="flex items-center gap-2">
      <div
        className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ring-1 ${
          isCsv
            ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
            : "bg-amber-400/10 text-amber-300 ring-amber-400/30"
        }`}
        title={
          isCsv
            ? "Figures computed from your uploaded CSVs in this browser — nothing left your machine"
            : "All figures are fictional — generated for demo purposes"
        }
      >
        {isCsv ? `YOUR DATA — ${data.brand.name}` : "SAMPLE DATA — fictional brand"}
      </div>
      {isCsv && (
        <button
          onClick={resetSample}
          className="flex min-h-[44px] items-center rounded-full bg-white/5 px-3 py-1 font-mono text-xs font-medium text-slate-400 ring-1 ring-white/10 hover:bg-white/10"
        >
          ← sample
        </button>
      )}
    </div>
  );
}
