/**
 * Phase 7 — wireframe claim verification. Every claim the v02 wireframes make
 * about the demo is asserted here against the real source: computed checks
 * (lib/*) plus source-presence checks (components/*). The footer count in
 * analytica-ux-wireframes-v02.html is the output of this script — generated,
 * never hand-asserted.
 *
 * Run:  npx tsx scripts/wireframe-claims.ts
 * Exit 0 with "verified N/N claims" when all pass, else 1 (lists failures).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sampleData } from "../lib/data";
import {
  buildCases,
  detectorStatus,
  isWorsened,
  waitingCases,
  worseningMetric,
} from "../lib/cases";
import { answerAsk, detectIntent, snapshotAsk, suggestedChips } from "../lib/ask";
import { trackSteps } from "../lib/tour";
import { canonicalHeader } from "../lib/aliases";

const ROOT = join(import.meta.dirname, "..");
let pass = 0;
let fail = 0;
const failures: string[] = [];

function claim(name: string, fn: () => boolean) {
  let ok = false;
  try {
    ok = fn() === true;
  } catch {
    ok = false;
  }
  if (ok) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`);
  }
}

function src(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function has(path: string, ...needles: string[]): boolean {
  const s = src(path);
  return needles.every((n) => s.includes(n));
}

const adsets = sampleData.adsets;
const spend = adsets.reduce((s, a) => s + a.spend_egp, 0);
const profit = adsets.reduce((s, a) => s + a.profit_egp, 0);
const roas = adsets.reduce((s, a) => s + a.platform_roas * a.spend_egp, 0) / spend;
const poas = profit / spend;

// --- Sample headlines (§2 hook cards) ---
claim("spend is EGP 80,000", () => spend === 80000);
claim("platform ROAS is 3.49×", () => roas.toFixed(2) === "3.49");
claim("true POAS is 1.19×", () => poas.toFixed(2) === "1.19");
claim("overstatement is 2.92×", () => (roas / poas).toFixed(2) === "2.92");

// --- Case table (§2 hit-list) ---
claim("4 sample cases in §2 order", () => {
  const ids = buildCases(sampleData).map((c) => c.id);
  return (
    JSON.stringify(ids) ===
    JSON.stringify([
      "leak-tiktok-3",
      "money-lookalike-purch",
      "money-tiktok-prosp",
      "drop-spring-broad",
    ])
  );
});
claim("rank 1 is the TikTok funnel leak worth 269,340", () => {
  const c = buildCases(sampleData)[0];
  return c.kind === "funnel-leak" && c.impactEgp === 269340;
});
claim("ranks 2–3 are money offenders with submitters", () => {
  const cases = buildCases(sampleData);
  return (
    cases[1].kind === "money-offender" &&
    cases[1].impactEgp === 24000 &&
    cases[2].submittedBy?.includes("Sara") === true &&
    cases[3].submittedBy?.includes("Ahmed") === true
  );
});
claim("rank 4 is the unsized ROAS drop", () => {
  const c = buildCases(sampleData)[3];
  return c.kind === "roas-drop" && c.impactEgp === null;
});

// --- Handled-state selector (P1-01/Phase 2) ---
claim("watched cases leave the waiting list", () => {
  const w = waitingCases(sampleData, ["leak-tiktok-3"], {});
  return w.length === 3 && w.every((c) => c.id !== "leak-tiktok-3");
});
claim("dismissed cases leave the list; resurfaced snoozes return", () => {
  const quiet = waitingCases(sampleData, [], { "leak-tiktok-3": { kind: "resolved" } });
  const back = waitingCases(sampleData, [], {
    "leak-tiktok-3": { kind: "snoozed", resurfaced: true },
  });
  return quiet.length === 3 && back.length === 4;
});

// --- Detector status (P1-02) ---
claim("all detectors run on the sample", () => {
  const st = detectorStatus(sampleData);
  return (
    st.roasDrop.status === "ran" && st.funnel.status === "ran" && st.adLinkage.status === "ran"
  );
});
claim("missing funnel/daily skip with file reasons", () => {
  const st = detectorStatus({
    ...sampleData,
    funnel: [],
    hasFunnel: false,
    daily: [],
    hasDaily: false,
  });
  return (
    st.funnel.status === "skipped" &&
    (st.funnel.reason ?? "").includes("funnel.csv") &&
    st.roasDrop.status === "skipped" &&
    (st.roasDrop.reason ?? "").includes("daily_adset.csv")
  );
});

// --- Snooze math (Phase 2) ---
claim("worsening needs >2% against the snapshot", () => {
  const m = worseningMetric(buildCases(sampleData)[0], sampleData);
  return (
    m !== null &&
    isWorsened({ kind: "funnel-leak", value: m }, m) === false &&
    isWorsened({ kind: "funnel-leak", value: m }, m * 1.1) === true
  );
});

// --- Ask intents (§10 table) ---
const intentCases: Array<[string, string]> = [
  ["Where should I focus?", "focus"],
  ["Which ad sets lose money?", "lie"],
  ["Why is TikTok checkout leaking?", "leak"],
  ["Why did Spring Broad ROAS drop?", "drop"],
  ["What's my real ROAS?", "profit"],
  ["What did I approve?", "status"],
  ["Meta vs TikTok?", "compare"],
  ["tell me a joke", "help"],
];
for (const [q, intent] of intentCases) {
  claim(`ask intent "${q}" → ${intent}`, () => detectIntent(q) === intent);
}
claim("action guard refuses 'approve the top case' with a plan", () => {
  const a = answerAsk(snapshotAsk(sampleData, [], {}), "approve the top case");
  return (
    a.intent === "action" &&
    a.text.startsWith("I can recommend, but I don't take actions on your behalf") &&
    a.caseId !== null
  );
});
claim("ask chips are state-computed (approval chip gated)", () => {
  const empty = suggestedChips(snapshotAsk(sampleData, [], {}));
  const full = suggestedChips(snapshotAsk(sampleData, ["leak-tiktok-3"], {}));
  return !empty.includes("What did I approve?") && full.includes("What did I approve?");
});

// --- Tour tracks (Phase 4) ---
claim("both tour tracks run 10 steps", () => {
  return trackSteps("vondera").length === 10 && trackSteps("marketer").length === 10;
});
claim("v-ask presents the built drawer, not a roadmap", () => {
  const s = trackSteps("vondera").find((x) => x.id === "v-ask");
  return (
    s !== undefined && s.openAsk === true && s.caption({} as never).includes("governed metrics")
  );
});

// --- Built surfaces exist in source ---
claim("dismiss chip row + reasons", () =>
  has("components/ViewCase.tsx", "Why dismiss?", "Already handled", "Not now", "Disagree", "Cancel")
);
claim("decision pills", () =>
  has(
    "components/ViewCase.tsx",
    "RESOLVED",
    "SNOOZED",
    "OVERRIDE LOGGED",
    "PENDING APPROVAL",
    "APPROVED · WATCHING"
  )
);
claim("handled log + resurface marker", () =>
  has(
    "components/ViewDetect.tsx",
    "Handled & snoozed",
    "Re-surfaced — worsened since snoozed",
    "Simulate worsening (demo)"
  )
);
claim("margin decomposition on Profit-lie Isolate", () =>
  has("components/ViewCase.tsx", "Where the margin goes")
);
claim("unsized impacts render without a figure", () =>
  has("components/ViewDetect.tsx", "impact not sized")
);
claim("upload honesty titles + row counts", () =>
  has("components/ViewUpload.tsx", "Couldn", "Loaded with notes", "rows")
);
claim("AI dialog: switch + disconnect, memory-only key", () =>
  has("components/AiToggle.tsx", "Disconnect (clear key)", "never saved")
);
claim("verify cards link back with confirm", () =>
  has("components/ViewVerify.tsx", "Open case →", "Yes, stop")
);
claim(
  "ask drawer with badge + provenance + fallback",
  () =>
    has("components/AskPanel.tsx", "answers from computed metrics", "Answered from:") &&
    has(
      "lib/ask.ts",
      "I can only answer from the metrics on screen",
      "I can recommend, but I don't take actions"
    )
);
claim(
  "presenter entry + coach panel + reset",
  () =>
    has("components/SiteNav.tsx", "Present") &&
    has("components/TourProvider.tsx", "Presenter coach", "Reset demo state")
);
claim("spotlight ring without layout change", () => has("app/globals.css", ".tour-spotlight"));
claim(
  "mobile: sticky bar, compact stepper, stacked cards",
  () =>
    has("components/ViewCase.tsx", "safe-area-inset-bottom") &&
    has("components/Stepper.tsx", "Step ", "STAGES.length") &&
    has("components/AdTable.tsx", "More numbers")
);
claim("upload hardening surfaces", () =>
  has("components/ViewUpload.tsx", "Download template CSVs", "File notes", "Compute cancelled")
);
claim("header aliases with TODO(real-export)", () => {
  return (
    has("lib/aliases.ts", "TODO(real-export)", "amount_spent") &&
    canonicalHeader("Amount Spent", ["spend_egp"]) === "spend_egp"
  );
});

// --- Harness files exist ---
for (const f of [
  "scripts/check-invariants.ts",
  "scripts/golden-path.spec.ts",
  "scripts/check-mobile.spec.ts",
  "scripts/tour.spec.ts",
  "scripts/ask.spec.ts",
  "scripts/hardening.spec.ts",
  "scripts/verify-static.mjs",
  "scripts/contrast.ts",
]) {
  claim(`harness ships ${f}`, () => {
    try {
      readFileSync(join(ROOT, f), "utf8");
      return true;
    } catch {
      return false;
    }
  });
}

const total = pass + fail;
console.log(`\nverified ${pass}/${total} claims`);
if (fail > 0) {
  console.error(`failures:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
