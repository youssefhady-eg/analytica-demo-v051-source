"use client";

import { useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { STEPS, STEP_LABELS } from "@/lib/funnel";
import type { FunnelRow } from "@/lib/types";
import { CHART_BASE_FONT, CHART_TITLE_FONT } from "@/lib/format";

/** Funnel visualization for one channel — dark ops-room styling. */
export default function FunnelChart({ funnel, channel, title }: { funnel: FunnelRow[]; channel: string; title: string }) {
  const totals: Record<string, number> = {};
  for (const r of funnel) {
    if (r.channel === channel) totals[r.step] = (totals[r.step] ?? 0) + r.count;
  }
  // P3-06: resize when the container (not just the window) changes.
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ resize(): void } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const option = {
    backgroundColor: "transparent",
    title: { text: title, left: "center", textStyle: { fontSize: CHART_TITLE_FONT, color: "#e2e8f0" } },
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c}",
      backgroundColor: "#0d1420",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: CHART_BASE_FONT },
    },
    series: [
      {
        type: "funnel",
        left: "10%",
        width: "80%",
        label: { formatter: "{b}\n{c}", color: "#cbd5e1", fontSize: CHART_BASE_FONT },
        itemStyle: { borderColor: "#070b12", borderWidth: 2 },
        data: STEPS.map((s, i) => ({
          name: STEP_LABELS[s],
          value: totals[s] ?? 0,
          itemStyle: {
            color: ["#22d3ee", "#34d399", "#fbbf24", "#fb7185"][Math.min(i, 3)],
            opacity: 0.85,
          },
        })),
      },
    ],
  };
  return (
    <div ref={wrapRef} className="h-[220px] w-full sm:h-[300px]">
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        onChartReady={(chart) => {
          chartRef.current = chart;
        }}
      />
    </div>
  );
}
