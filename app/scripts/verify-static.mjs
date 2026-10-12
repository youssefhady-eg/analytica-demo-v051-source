/**
 * Phase 0 — G2 file:// safety (static scan of `out/` + sources).
 *
 * Mirrors the brief §4 G2 greps, implemented in dependency-free node so it
 * runs on Windows (no grep) and in CI:
 *  1. `out/*.html` contains no root-absolute `src="/` / `href="/` refs.
 *  2. `components/`, `lib/`, `app/` (excl. .next/out/node_modules) contain no
 *     `next/link`, `next/navigation`, `useRouter`, `useSearchParams`,
 *     `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`.
 *  3. `fetch(` appears only in `lib/llm.ts` (the user-initiated BYOK call).
 *
 * Run:  node scripts/verify-static.mjs   (or: npm run verify:static)
 * Exit 0 on pass, 1 on any violation (prints the violation).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
let failures = 0;

function fail(msg) {
  failures += 1;
  console.error(`  FAIL ${msg}`);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === "node_modules" || e === ".next" || e === "out") continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?|css|json)$/.test(e)) {
      out.push(p);
    }
  }
  return out;
}

// --- 1. out/*.html: no root-absolute asset refs ---
console.log("G2.1 out/*.html root-absolute refs:");
const outDir = join(ROOT, "out");
let htmlFiles;
try {
  htmlFiles = readdirSync(outDir).filter((f) => f.endsWith(".html"));
} catch {
  fail("out/ directory missing — run `npm run build` first");
  htmlFiles = [];
}
for (const f of htmlFiles) {
  const html = readFileSync(join(outDir, f), "utf8");
  const abs = [...html.matchAll(/(?:src|href)="\//g)];
  if (abs.length > 0) fail(`${f}: ${abs.length} root-absolute src/href ref(s)`);
  else console.log(`  PASS ${f}: no root-absolute asset refs`);
}

// --- 2. forbidden client APIs in sources ---
console.log("G2.2 forbidden imports/APIs in components+lib+app:");
const banned = [
  "next/link",
  "next/navigation",
  "useRouter",
  "useSearchParams",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "document.cookie",
];
for (const d of ["components", "lib", "app"].map((x) => join(ROOT, x))) {
  for (const f of walk(d)) {
    const src = readFileSync(f, "utf8");
    for (const b of banned) {
      if (src.includes(b)) fail(`${relative(ROOT, f)} contains ${JSON.stringify(b)}`);
    }
  }
}
console.log("  PASS scan complete (violations, if any, listed above)");

// --- 3. fetch( only in lib/llm.ts ---
console.log("G2.3 fetch( allowlist:");
const fetchHits = [];
for (const d of ["components", "lib", "app"].map((x) => join(ROOT, x))) {
  for (const f of walk(d)) {
    if (!/\.(tsx?|jsx?)$/.test(f)) continue;
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes("fetch(") && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        fetchHits.push(`${relative(ROOT, f)}:${i + 1}`);
      }
    });
  }
}
const allowed = (h) => h.startsWith("lib\\llm.ts") || h.startsWith("lib/llm.ts");
const bad = fetchHits.filter((h) => !allowed(h));
if (bad.length > 0) fail(`fetch( outside lib/llm.ts: ${bad.join(", ")}`);
else console.log(`  PASS fetch( only in lib/llm.ts (${fetchHits.length} call site(s))`);

if (failures > 0) {
  console.error(`\nverify:static: ${failures} violation(s)`);
  process.exit(1);
}
console.log("\nverify:static: all checks passed");
