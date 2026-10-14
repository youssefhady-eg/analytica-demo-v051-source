/**
 * Phase 3 (P3-08) — WCAG AA contrast check for the Tailwind text/background
 * pairs the demo actually uses. Page background is #070b12; cards are
 * bg-white/[0.03] over it (mixed here to an effective solid).
 *
 * Run:  npx tsx scripts/contrast.ts   (or: npm run verify:contrast)
 * Exit 0 when every informational pair is ≥ 4.5:1, else 1 (lists failures).
 */

// Hex values from the Tailwind v3 palette.
const INK: Record<string, string> = {
  "slate-950": "#020617",
  "slate-100": "#f1f5f9",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "slate-400": "#94a3b8",
  "cyan-300": "#67e8f9",
  "cyan-400": "#22d3ee",
  "emerald-300": "#6ee7b7",
  "emerald-400": "#34d399",
  "amber-200": "#fde68a",
  "amber-300": "#fcd34d",
  "rose-300": "#fda4af",
  "rose-400": "#fb7185",
};

const PAGE = "#070b12";

function hex(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function lum(h: string): number {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = hex(h).map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White overlay (alpha) composited over the page background. */
function mixOver(fg: string, alpha: number, bg: string): string {
  const [fr, fg_, fb] = hex(fg);
  const [br, bg_, bb] = hex(bg);
  const m = (f: number, b: number) => Math.round((f * alpha + b * (1 - alpha)) * 255);
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(m(fr, br))}${to(m(fg_, bg_))}${to(m(fb, bb))}`;
}

function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const CARD = mixOver("#ffffff", 0.03, PAGE); // bg-white/[0.03]
console.log(`backgrounds: page ${PAGE}, card ≈ ${CARD}`);

const TEXT_ON_DARK = [
  "slate-100",
  "slate-200",
  "slate-300",
  "slate-400",
  "cyan-300",
  "cyan-400",
  "emerald-300",
  "emerald-400",
  "amber-200",
  "amber-300",
  "rose-300",
  "rose-400",
];
const SOLID_BUTTONS: Array<[string, string, string]> = [
  ["slate-950", "#22d3ee", "button text on cyan-400"],
  ["slate-950", "#34d399", "button text on emerald-400"],
];

let failures = 0;
for (const bg of [PAGE, CARD]) {
  for (const fg of TEXT_ON_DARK) {
    const r = ratio(INK[fg], bg);
    const ok = r >= 4.5;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? "PASS" : "FAIL"} ${fg} on ${bg === PAGE ? "page" : "card"}: ${r.toFixed(2)}:1`
    );
  }
}
for (const [fg, bg, label] of SOLID_BUTTONS) {
  const r = ratio(INK[fg], bg);
  const ok = r >= 4.5;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}: ${r.toFixed(2)}:1`);
}

if (failures > 0) {
  console.error(`\ncontrast: ${failures} pair(s) below 4.5:1`);
  process.exit(1);
}
console.log("\ncontrast: all pairs ≥ 4.5:1 (AA)");
