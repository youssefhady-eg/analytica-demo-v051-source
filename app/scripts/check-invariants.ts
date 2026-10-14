/**
 * Phase 0 — G4 Invariants.
 * Asserts the OPENCODE_BUILD_BRIEF.md §2 ground truth on the untouched v05.1
 * sample data: the four headline numbers and the sample-mode case table.
 *
 * Run:  npx tsx scripts/check-invariants.ts   (or: npm run verify:invariants)
 * Exit 0 on pass, 1 on any mismatch (prints the mismatch).
 */
import { sampleData } from "../lib/data";
import { buildCases } from "../lib/cases";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  PASS ${name}: ${String(actual)}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// --- Headline numbers (brief §1.8: spend 80,000; ROAS 3.49×; POAS 1.19×; over 2.92×) ---
const adsets = sampleData.adsets;
const totalSpend = adsets.reduce((s, a) => s + a.spend_egp, 0);
const totalProfit = adsets.reduce((s, a) => s + a.profit_egp, 0);
const blendedRoas = totalSpend
  ? adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / totalSpend
  : 0;
const blendedPoas = totalSpend ? totalProfit / totalSpend : 0;
const overstatement = blendedPoas ? blendedRoas / blendedPoas : 0;

console.log("headlines:");
check("spend", totalSpend, 80000);
check("platform ROAS (2dp)", blendedRoas.toFixed(2), "3.49");
check("true POAS (2dp)", blendedPoas.toFixed(2), "1.19");
check("overstatement (2dp)", overstatement.toFixed(2), "2.92");

// --- Sample-mode case table (brief §2) ---
const cases = buildCases(sampleData);
console.log("cases:");
check("case count", cases.length, 4);
const expected: Array<{
  id: string;
  kind: string;
  impact: number | null;
  source: string;
}> = [
  { id: "leak-tiktok-3", kind: "funnel-leak", impact: 269340, source: "detected" },
  { id: "money-lookalike-purch", kind: "money-offender", impact: 24000, source: "detected" },
  { id: "money-tiktok-prosp", kind: "money-offender", impact: 16000, source: "submitted" },
  { id: "drop-spring-broad", kind: "roas-drop", impact: null, source: "submitted" },
];
expected.forEach((e, i) => {
  const c = cases[i];
  check(`rank ${i + 1} id`, c?.id, e.id);
  check(`rank ${i + 1} kind`, c?.kind, e.kind);
  check(`rank ${i + 1} impactEgp`, c?.impactEgp ?? null, e.impact);
  check(`rank ${i + 1} source`, c?.source, e.source);
});

// Spot-check the brief's parenthetical ground truth (rates, ROAS pairs, submitters).
check("rank1 detail has 8.1%", cases[0]?.detail.includes("8.1%"), true);
check("rank1 detail has 4.6%", cases[0]?.detail.includes("4.6%"), true);
check(
  "rank2 detail 2.90× vs 0.82×",
  cases[1]?.detail.includes("2.90") && cases[1]?.detail.includes("0.82"),
  true
);
check("rank3 Sara submitter", cases[2]?.submittedBy?.includes("Sara"), true);
check(
  "rank3 detail 3.80× vs 0.81×",
  cases[2]?.detail.includes("3.80") && cases[2]?.detail.includes("0.81"),
  true
);
check("rank4 Ahmed submitter", cases[3]?.submittedBy?.includes("Ahmed"), true);
check("rank4 title has 14%", cases[3]?.title.includes("14%"), true);

if (failures > 0) {
  console.error(`\ninvariants: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\ninvariants: all checks passed");
