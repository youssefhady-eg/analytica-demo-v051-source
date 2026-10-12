export const fmtEGP = (n: number) =>
  new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtX = (n: number) => `${n.toFixed(2)}\u00d7`;

export const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/** P3-06: single source for ECharts font sizes (12px minimum for readable
 *  labels on phones). */
export const CHART_BASE_FONT = 12;
export const CHART_TITLE_FONT = 14;
