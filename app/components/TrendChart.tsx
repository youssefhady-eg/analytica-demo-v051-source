"use client";

import { useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { DailyRow } from "@/lib/types";
import { CHART_BASE_FONT, CHART_TITLE_FONT } from "@/lib/format";

/** Daily spend + platform ROAS trend for one ad set — dark ops-room styling. */
export default function TrendChart({ rows, title }: { rows: DailyRow[]; title: string }) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
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
  const axis = {
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
    axisLabel: { color: "#94a3b8", fontSize: CHART_BASE_FONT },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
  };
  const option = {
    backgroundColor: "transparent",
    title: { text: title, left: "center", textStyle: { fontSize: CHART_TITLE_FONT, color: "#e2e8f0" } },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0d1420",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: CHART_BASE_FONT },
    },
    legend: {
      data: ["Spend (EGP)", "Platform ROAS"],
      bottom: 0,
      type: "scroll",
      textStyle: { color: "#94a3b8", fontSize: CHART_BASE_FONT },
    },
    xAxis: { type: "category", data: sorted.map((r) => r.date.slice(5)), ...axis },
    yAxis: [
      { type: "value", name: "EGP", nameTextStyle: { color: "#94a3b8", fontSize: CHART_BASE_FONT }, ...axis },
      { type: "value", name: "ROAS", nameTextStyle: { color: "#94a3b8", fontSize: CHART_BASE_FONT }, ...axis },
    ],
    series: [
      {
        name: "Spend (EGP)",
        type: "bar",
        data: sorted.map((r) => r.spend_egp),
        itemStyle: { color: "rgba(34,211,238,0.5)", borderRadius: [3, 3, 0, 0] },
      },
      {
        name: "Platform ROAS",
        type: "line",
        yAxisIndex: 1,
        data: sorted.map((r) => r.platform_roas),
        itemStyle: { color: "#22d3ee" },
        lineStyle: { width: 3, shadowColor: "rgba(34,211,238,0.5)", shadowBlur: 12 },
        symbol: "circle",
        symbolSize: 6,
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
