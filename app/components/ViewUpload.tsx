"use client";

import { useState } from "react";
import { Card, Text, Title, Eyebrow } from "@/components/ui";
import { parseCsv, type ParsedFile } from "@/lib/csv";
import { computeFromCsv } from "@/lib/compute";
import { useDemoData } from "@/components/DataProvider";
import { fmtEGP, fmtX } from "@/lib/format";
import type { CsvTables, DemoData } from "@/lib/types";

const FILES: { key: keyof CsvTables; label: string; required: boolean; hint: string }[] = [
  { key: "spend", label: "spend.csv", required: true, hint: "adset_id, adset_name, channel, spend_egp, platform_roas" },
  { key: "orders", label: "orders.csv", required: true, hint: "order_id, adset_id, order_value_egp, courier_status, cogs_egp?, shipping_cost_egp?, ad_id?" },
  { key: "ads", label: "ads.csv", required: false, hint: "ad_id, ad_name, adset_id, spend_egp, platform_roas, frequency, ctr_14d_ago, ctr_now" },
  { key: "daily", label: "daily_adset.csv", required: false, hint: "date, adset_id, spend_egp, platform_roas, cpc_egp, ctr_pct, aov_egp, failed_delivery_rate_pct" },
  { key: "funnel", label: "funnel.csv", required: false, hint: "date, channel, step, count" },
];

/** P1-05: success banner figures — computed from the loaded data, never typed. */
function loadedSummary(d: DemoData): string {
  const spend = d.adsets.reduce((s, a) => s + a.spend_egp, 0);
  const profit = d.adsets.reduce((s, a) => s + a.profit_egp, 0);
  const roas = spend ? d.adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / spend : 0;
  const poas = spend ? profit / spend : 0;
  return `${d.brand.name}: ${fmtEGP(spend)} ad spend, platform ROAS ${fmtX(roas)}, true POAS ${fmtX(poas)} — the whole walkthrough now runs on these numbers.`;
}

export default function ViewUpload({ onDone }: { onDone: () => void }) {
  const { setCsvData, data } = useDemoData();
  const [texts, setTexts] = useState<Partial<Record<keyof CsvTables, string>>>({});
  const [brand, setBrand] = useState("");
  const [cogs, setCogs] = useState("0");
  const [ship, setShip] = useState("60");
  const [rship, setRship] = useState("60");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  // P1-05: per-file row counts live next to each slot — not in the warnings.
  const [counts, setCounts] = useState<Partial<Record<keyof CsvTables, number>>>({});

  const onFile = (key: keyof CsvTables, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTexts((t) => ({ ...t, [key]: String(reader.result ?? "") }));
    reader.readAsText(file);
  };

  const run = () => {
    const errs: string[] = [];
    const warns: string[] = [];
    const tables = {} as CsvTables;
    const parsed: Partial<Record<keyof CsvTables, number>> = {};
    for (const f of FILES) {
      const text = texts[f.key];
      if (!text) {
        if (f.required) errs.push(`${f.label} is required — attach the file.`);
        tables[f.key] = [];
        continue;
      }
      const pf: ParsedFile = parseCsv(f.key, text);
      errs.push(...pf.errors);
      warns.push(...pf.warnings);
      if (pf.rows.length > 0) parsed[f.key] = pf.rows.length;
      tables[f.key] = pf.rows;
    }
    setCounts(parsed);
    if (errs.length > 0) {
      setErrors(errs);
      setWarnings(warns);
      setLoaded(false);
      return;
    }
    const res = computeFromCsv(tables, {
      brand: brand.trim(),
      cogs: parseFloat(cogs) || 0,
      ship: parseFloat(ship) || 0,
      rship: parseFloat(rship) || 0,
    });
    setErrors(res.errors);
    setWarnings([...warns, ...res.warnings]);
    if (res.data) {
      setCsvData(res.data);
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow className="!text-emerald-300">Your data</Eyebrow>
      <h1 className="mb-2 mt-1 text-3xl font-bold tracking-tight text-slate-50">Load your CSVs</h1>
      <p className="mb-6 max-w-2xl text-slate-400">
        Drop in a merchant export and the whole walkthrough re-renders on their numbers —
        parsed and computed right here in your browser. Nothing is uploaded anywhere.
        Only <span className="font-semibold text-slate-200">spend.csv</span> and{" "}
        <span className="font-semibold text-slate-200">orders.csv</span> are required; the rest unlock
        their parts of the investigation when present.
      </p>

      <Card className="mb-6 p-5">
        <Title>Files</Title>
        <div className="mt-4 space-y-4">
          {FILES.map((f) => (
            <div key={f.key} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <span className="font-mono text-sm font-medium text-slate-300 sm:w-40">
                {f.label}{" "}
                {f.required ? (
                  <span className="text-rose-400">*</span>
                ) : (
                  <span className="text-xs font-normal text-slate-400">(optional)</span>
                )}
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => onFile(f.key, e.target.files?.[0])}
                className="min-h-[44px] font-mono text-sm text-slate-400 sm:min-h-0"
              />
              {texts[f.key] && counts[f.key] != null ? (
                <span className="font-mono text-xs text-emerald-300">✓ {counts[f.key]?.toLocaleString()} rows</span>
              ) : texts[f.key] ? (
                <span className="font-mono text-xs text-slate-400">✓ attached — run Compute to parse</span>
              ) : null}
              <p className="w-full font-mono text-xs text-slate-400">{f.hint}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6 p-5">
        <Title>Brand & cost defaults</Title>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-slate-400">Brand name</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. InYourShoe" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-400 min-h-[44px]" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-slate-400">Default COGS (EGP)</span>
            <input value={cogs} onChange={(e) => setCogs(e.target.value)} inputMode="decimal" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-400 min-h-[44px]" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-slate-400">Default shipping (EGP)</span>
            <input value={ship} onChange={(e) => setShip(e.target.value)} inputMode="decimal" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-400 min-h-[44px]" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-slate-400">Default return shipping</span>
            <input value={rship} onChange={(e) => setRship(e.target.value)} inputMode="decimal" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-400 min-h-[44px]" />
          </label>
        </div>
        <Text className="mt-2 font-mono text-xs">
          Used only where orders.csv leaves cogs/shipping cells blank.
        </Text>
      </Card>

      {/* P1-05: honest titles — never "Loaded with notes" when load failed. */}
      {errors.length > 0 && (
        <Card className="mb-6 border-rose-500/40 bg-rose-500/[0.06] p-5">
          <Title className="text-rose-300">Couldn&apos;t load</Title>
          <ul className="mt-2 list-disc pl-5 text-sm text-rose-300">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          {data.source === "csv" && (
            <p className="mt-2 text-sm text-slate-300">
              Still showing your previous data ({data.brand.name}) — this attempt didn&apos;t load.
            </p>
          )}
        </Card>
      )}
      {errors.length === 0 && loaded && warnings.length > 0 && (
        <Card className="mb-6 border-amber-400/30 bg-amber-400/[0.05] p-5">
          <Title className="text-amber-300">Loaded with notes</Title>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-200">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Card>
      )}
      {errors.length === 0 && loaded && warnings.length === 0 && (
        <Card className="mb-6 border-emerald-400/30 bg-emerald-400/[0.05] p-5">
          <Title className="text-emerald-300">Loaded</Title>
          <Text className="mt-2">
            {loadedSummary(data)}
          </Text>
        </Card>
      )}
      {errors.length === 0 && loaded && warnings.length > 0 && (
        <Card className="mb-6 border-emerald-400/30 bg-emerald-400/[0.05] p-5">
          <Title className="text-emerald-300">Loaded — {data.brand.name}</Title>
          <Text className="mt-2">{loadedSummary(data)}</Text>
        </Card>
      )}

      <div className="flex gap-3">
        <button
          onClick={run}
          className="rounded-lg bg-emerald-400 px-6 py-3 font-mono text-base font-bold text-slate-950 hover:bg-emerald-300"
        >
          Compute & load into demo →
        </button>
        {loaded && (
          <button
            onClick={onDone}
            className="rounded-lg bg-cyan-400 px-6 py-3 font-mono text-base font-bold text-slate-950 hover:bg-cyan-300"
          >
            Walk through {data.brand.name} →
          </button>
        )}
      </div>
      <p className="mt-4 font-mono text-xs text-slate-400">
        Currently showing: {data.source === "csv" ? `merchant data (${data.brand.name})` : "the fictional sample"}. Switch back anytime from the badge, top right.
      </p>
    </div>
  );
}
