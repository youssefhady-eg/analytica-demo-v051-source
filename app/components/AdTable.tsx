"use client";

import { useState } from "react";
import {
  Card,
  Text,
  Title,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
} from "@/components/ui";
import { useDemoData } from "./DataProvider";
import {
  adFlags,
  heroCutoff,
  profitConcentration,
  type AdFlag,
  type LinkedAd,
} from "@/lib/metrics";
import { fmtEGP, fmtX, fmtPct } from "@/lib/format";
import Sparkline from "./Sparkline";

const FLAG_STYLE: Record<AdFlag, string> = {
  FATIGUING: "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30",
  ZOMBIE: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/40",
  HERO: "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30",
};

/** Per-creative profit table for one ad set — the level the marketer acts on. */
export default function AdTable({ adsetId, onUpload }: { adsetId: string; onUpload?: () => void }) {
  const { data } = useDemoData();
  // P3-05: the scroll hint shows until the marketer scrolls the table once.
  // Must sit above the early returns below — a hook after a conditional
  // return changes hook order when ads data loads.
  const [scrolled, setScrolled] = useState(false);

  if (!data.hasAds) {
    return (
      <Card className="border-dashed border-white/20 p-5">
        <Title>🔒 Per-creative data not loaded</Title>
        <Text className="mt-2">
          Upload <span className="font-mono text-sm">ads.csv</span> to unlock the drill-down.
        </Text>
        {onUpload && (
          <button
            onClick={onUpload}
            className="mt-3 inline-block font-mono text-sm font-medium text-emerald-300 hover:underline"
          >
            ↑ Load ads.csv
          </button>
        )}
      </Card>
    );
  }
  if (!data.hasAdLinkage) {
    return (
      <Card className="border-amber-400/30 bg-amber-400/[0.05] p-5">
        <Title>🔒 Per-ad profit needs order↔ad linkage</Title>
        <Text className="mt-2">
          <span className="font-mono text-sm">orders.csv</span> has no{" "}
          <span className="font-mono text-sm">ad_id</span> — no order can be tied to its creative.
          Capture click IDs / UTMs at checkout to unlock this.
        </Text>
      </Card>
    );
  }

  const adset = data.adsets.find((a) => a.id === adsetId);
  const adList = data.ads.filter(
    (a): a is LinkedAd => a.adset_id === adsetId && a.poas !== null && a.profit_egp !== null
  );
  if (adList.length === 0) return null;
  const cutoff = heroCutoff(adList);
  const conc = profitConcentration(adList);
  const rows = [...adList].sort((a, b) => b.profit_egp - a.profit_egp);

  return (
    <Card className="p-5">
      <Text>
        {conc.n} of {conc.y} creatives drive {conc.pct.toFixed(0)}% of the profit
        {adset ? (
          <>
            {" "}
            in <span className="font-semibold text-slate-200">{adset.name}</span>
          </>
        ) : (
          ""
        )}
        . Fatigue is flagged on <span className="font-semibold text-slate-200">profit</span>, not
        CTR.
      </Text>
      {!scrolled && (
        <p
          className="mb-1 mt-3 text-right font-mono text-xs text-slate-400 sm:hidden"
          aria-hidden="true"
        >
          scroll →
        </p>
      )}
      {/* P3-05: below sm the same creatives render as stacked cards — name,
          POAS and flags first, the rest behind a details disclosure. */}
      <div className="mt-2 space-y-3 sm:hidden">
        {rows.map((ad) => {
          const flags = adFlags(ad, cutoff);
          return (
            <div key={ad.ad_id} className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-200">{ad.ad_name}</p>
                <span
                  className={
                    ad.poas < 1
                      ? "shrink-0 font-mono font-semibold tabular-nums text-rose-400"
                      : "shrink-0 font-mono tabular-nums text-slate-200"
                  }
                >
                  {fmtX(ad.poas)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {flags.length === 0 && <span className="text-sm text-slate-400">—</span>}
                {flags.map((f) => (
                  <Badge key={f} className={FLAG_STYLE[f]}>
                    {f}
                  </Badge>
                ))}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer font-mono text-xs text-slate-400">
                  More numbers
                </summary>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Spend</dt>
                    <dd className="font-mono tabular-nums text-slate-300">
                      {fmtEGP(ad.spend_egp)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Platform ROAS</dt>
                    <dd className="font-mono tabular-nums text-slate-300">
                      {fmtX(ad.platform_roas)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">CTR 14d → now</dt>
                    <dd className="font-mono tabular-nums text-slate-300">
                      {fmtPct(ad.ctr_14d_ago)} → {fmtPct(ad.ctr_now)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Frequency</dt>
                    <dd className="font-mono tabular-nums text-slate-300">
                      {ad.frequency.toFixed(1)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-400">CPR trend</dt>
                    <dd>
                      {ad.cpr_trend ? (
                        <Sparkline points={ad.cpr_trend} />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </details>
            </div>
          );
        })}
      </div>
      <div className="relative mt-4 hidden sm:block">
        {!scrolled && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-10 bg-gradient-to-l from-[#0b111c] to-transparent"
          />
        )}
        <Table
          className="sticky-first min-w-[720px]"
          onScroll={(e) => {
            if (e.currentTarget.scrollLeft > 8) setScrolled(true);
          }}
        >
          <TableHead>
            <TableRow>
              <TableHeaderCell>Creative</TableHeaderCell>
              <TableHeaderCell>Spend</TableHeaderCell>
              <TableHeaderCell>Platform ROAS</TableHeaderCell>
              <TableHeaderCell>Profit POAS</TableHeaderCell>
              <TableHeaderCell>CTR (14d → now)</TableHeaderCell>
              <TableHeaderCell>Freq.</TableHeaderCell>
              <TableHeaderCell>CPR trend</TableHeaderCell>
              <TableHeaderCell>Flags</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((ad) => {
              const flags = adFlags(ad, cutoff);
              return (
                <TableRow key={ad.ad_id}>
                  <TableCell className="font-medium text-slate-200">{ad.ad_name}</TableCell>
                  <TableCell className="font-mono tabular-nums">{fmtEGP(ad.spend_egp)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{fmtX(ad.platform_roas)}</TableCell>
                  <TableCell
                    className={
                      ad.poas < 1
                        ? "font-mono font-semibold tabular-nums text-rose-400"
                        : "font-mono tabular-nums"
                    }
                  >
                    {fmtX(ad.poas)}
                  </TableCell>
                  <TableCell>
                    {fmtPct(ad.ctr_14d_ago)} → {fmtPct(ad.ctr_now)}
                  </TableCell>
                  <TableCell>{ad.frequency.toFixed(1)}</TableCell>
                  <TableCell>
                    {ad.cpr_trend ? (
                      <Sparkline points={ad.cpr_trend} />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {flags.length === 0 && <span className="text-slate-400">—</span>}
                      {flags.map((f) => (
                        <Badge key={f} className={FLAG_STYLE[f]}>
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
