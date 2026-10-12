# Analytica Demo Prototype — Build Spec

**For:** AI coding agents (Youssef's build setup).
**Purpose:** clickable product sample to show performance/growth marketers in feedback meetings.
**Nature:** demo — synthetic data, statically served, no backend. Every frame carries a "SAMPLE DATA" badge.

---

## 0. Objective & non-goals

**Objective:** a 6-frame clickable demo built on two equal pillars: **(1) "your numbers lie"** — platform ROAS vs true profit POAS; **(2) "here's where you leak conversion"** — funnel/journey leak detection with money attached. Story: *your numbers lie → here's where you leak conversion → what it's costing you → down to the ad → why it moved → what the real product becomes.*

**Non-goals:** no ClickHouse / dbt / Cube, no auth, no live data connectors, no LLM (diagnosis text is static), no AI Analyst chat, no MMM / forecasting / benchmarks, no creative-content AI (vision models judging ad imagery), no real action execution.

---

## 1. Tech

- Next.js (App Router) with static export (`output: 'export'`). Must run with `npm install && npm run dev` and `npm run build` must succeed.
- Tremor for KPI cards and tables; ECharts for trend charts and the funnel.
- All data: static JSON in `/data/*.json`, imported at build time. No API routes, no backend.
- Currency: EGP, formatted en-EG.
- Global persistent badge on every frame: **"SAMPLE DATA — fictional brand"**.

---

## 2. Frames (in order — two pillars)

### Frame 1 — Their number vs true number (pillar 1: your numbers lie — the hook)
- Per-ad-set table: ad set name, channel, spend (EGP), platform ROAS, true profit-based POAS, gap (ROAS − POAS). Sortable, default sort by gap descending.
- Top banner: blended platform ROAS vs blended true POAS + overstatement factor (blended ROAS ÷ blended POAS).
- "Assumptions" drawer (lists the POAS assumptions — same as the validation kit's A1–A5, A7).
- Click an ad set → Frame 4.
- Speaks the marketer's existing metrics. No new metric language.

### Frame 2 — Where you leak conversion (pillar 2: here's where you leak)
- Full funnel per channel: sessions → add-to-cart → checkout → purchase (counts + step conversion %).
- Leak callouts: the biggest drop-off step per channel, highlighted, with EGP impact (lost purchases × AOV).
- Embedded worked case: TikTok checkout→purchase **8.2% → 4.1%** over 7 days; Meta stable at ~9%.
- **Diagnosis** (static): "Traffic is fine. TikTok buyers stall at checkout."
- **Proposed action card:** "WhatsApp nudge to TikTok checkout abandoners from the last 48h." Status pill: **PENDING APPROVAL**. Approve / Dismiss buttons are mock — clicking shows a toast: "Demo only — no backend."
- This frame is the second pillar, not a side case — it gets equal billing with Frame 1.

### Frame 3 — The money slide (the lean-in moment)
- Filter: platform ROAS ≥ 2.5 **and** true POAS < 1.0 — "ad sets that look profitable but lose money."
- One big number: total EGP/month wasted on those ad sets.
- One-line takeaway, e.g. "EGP X of your monthly spend looks profitable on the platform and loses money in reality."
- CTA: "See which ads" → Frame 4 for the top offender.

### Frame 4 — Ad drill-down (the level they act on)
- Per ad/creative in the selected ad set: ad name, spend, platform ROAS, profit POAS, CTR now vs 14 days ago, frequency, CPR trend sparkline.
- Computed flags:
  - **FATIGUING** if `ctr_now < 0.6 × ctr_14d_ago` AND `frequency ≥ 3.5`
  - **ZOMBIE** if `POAS < 1.0` AND `spend ≥ 2,000 EGP`
  - **HERO** if POAS in the top quartile of the ad set
- Summary line: "X of Y creatives drive Z% of the profit."
- Differentiator to surface in copy: fatigue is flagged on **profit**, not CTR — a creative can hold CTR and still be a zombie if its traffic doesn't turn into cash.

### Frame 5 — Case: ROAS drop diagnosis (Trigger → Evidence → Diagnosis → Proposed action)
- **Trigger card** (anomaly alert): "Spring Collection – Broad: ROAS −22% in 7 days."
- **Evidence:** 14-day trend chart (spend, platform ROAS); decomposition bullets — CPC flat, CTR flat, AOV −15%, failed-delivery rate 11% → 21% (Greater Cairo); ad-level culprit callout — "Creative D: CTR 2.4% → 1.2% in 10 days at frequency 4.1."
- **Diagnosis** (static text): "Your ads are fine. The leak is post-click — orders aren't turning into cash."
- **Proposed action card:** "Pause creative D, shift its EGP 6,500/week budget to creatives A and B." Status pill: **PENDING APPROVAL** (mock buttons as in Frame 2).

### Frame 6 — Where this goes next (honest closer)
- Plain-language, one screen: "This demo runs on fictional data. The production product connects your live ad spend, orders, and courier outcomes; the AI Analyst reasons over governed metrics; MMM and forecasting arrive in Phase 3."
- No fake screenshots of unbuilt features. Sample-data reminder repeated.

**The arc:** your numbers lie → here's where you leak conversion → what it's costing → down to the ad → why it moved → what the real product is.

---

## 3. Data contract

Reuse the validation kit's `template_spend.csv` / `template_orders.csv` column layouts. New generator inputs:

- `ads.csv`: `ad_id, ad_name, adset_id, spend_egp, impressions, clicks, platform_roas, frequency, ctr_14d_ago, ctr_now`
- `daily_adset.csv`: `date, adset_id, spend_egp, platform_roas, cpc_egp, ctr_pct, aov_egp, failed_delivery_rate_pct`
- `funnel.csv`: `date, channel, step, count` — steps: `session, add_to_cart, checkout, purchase`; channels: `meta, tiktok`
- `orders.csv`: kit template **plus `ad_id`** (order↔ad attribution).
  - ⚠️ Mark clearly in code comments: ad-level profit is **synthetic-only** until production has UTM / click-ID stitching for order↔ad linkage.

**Generator:** Python, seeded (`seed=7`, reproducible), outputs `/data/*.json`:
`adsets.json, ads.json, daily_adset.json, funnel.json, diagnoses.json` (static case texts), `meta.json` (brand profile, assumptions text).
POAS math must mirror the validation kit assumptions A1–A5, A7.

---

## 4. Synthetic stories (engineered, internally consistent)

**Brand:** "Cairo Thread" — fictional D2C fashion, ~EGP 80,000/month ad spend, AOV ~EGP 850.

**Ad sets:**
| Ad set | Channel | Spend (EGP/mo) |
|---|---|---|
| Spring Collection – Broad | Meta | 22,000 |
| Retargeting – ATC 30d | Meta | 18,000 |
| Lookalike – Purchasers | Meta | 24,000 |
| TikTok – Prospecting | TikTok | 16,000 |

- Blended: platform ROAS ~3.6×, true POAS ~1.3× (overstatement ~2.8×).
- **Story A** (`daily_adset.csv`, last 14 days): "Spring Collection – Broad" platform ROAS 3.4 → 2.65 (−22%) over the last 7 days; CPC and CTR flat throughout; AOV 880 → 748 (−15%); failed-delivery rate 11% → 21% (Greater Cairo).
  - Creative D: spend 6,500, CTR 2.4% → 1.2%, frequency 4.1 → FATIGUING; POAS 0.7 → ZOMBIE. Creatives A, B are HEROes.
- **Story B** (`funnel.csv`, last 14 days — feeds Frame 2): TikTok checkout→purchase 8.2% → 4.1%; Meta 9.0% → 8.8% (stable). Other steps stable on both. Generator computes the EGP leak impact (lost purchases × AOV 850); anchor expectation ~EGP 250–300k/month on TikTok checkout.
- Tune the generator so the Frame 3 filter (ROAS ≥ 2.5, POAS < 1.0) yields **≥ 2 ad sets**.

---

## 5. Computed vs mocked

**COMPUTED** (real logic, at generation or render time): POAS, gaps, blended numbers, overstatement factor, fatigue / zombie / hero flags, funnel step conversion %, leak EGP impact, wasted-spend filter, hero/zombie profit-concentration line.

**MOCKED** (static, marked with `# MOCK — demo only` comments): diagnosis texts, proposed actions, the alert trigger, Approve/Dismiss buttons (toast "Demo only — no backend").

---

## 6. Form rules (marketer-facing)

- Casual register, plain words. No unexplained jargon.
- **No COD framing** — profit-truth and funnel language only. (Product scope on COD is a separate decision; this is demo form.)
- "SAMPLE DATA — fictional brand" badge on every frame. Assumptions drawer on Frame 1.
- The demo's job is workflow feedback ("would you open this every morning?"), not proof. Proof is the real-export run.

---

## 7. Acceptance

- [ ] `npm run dev` renders 6 frames; nav order 1→6 with click-throughs (Frame 1 → 4, Frame 3 → 4).
- [ ] All numbers consistent across frames (single generator source, seeded).
- [ ] Sample-data badge visible on every frame; mocked elements marked in code.
- [ ] `npm run build` static export succeeds.
- [ ] Fatigue/zombie/hero flags compute from the stated rules; Frame 3 filter yields ≥ 2 ad sets; Frame 2 leak impact computes from funnel data.

---

## 8. v04 addendum (2026-10-10) — merchant data + smarter demo

The static prototype approach is unchanged (Next.js export, JSON at build; no ClickHouse/dbt/Cube/auth/pipelines). v04 adds two CSV ingestion paths and makes the demo compute instead of recite.

### 8.1 CSV ingestion (both)
- **Build-time**: `app/ingest_csvs.py` — `spend.csv` + `orders.csv` required; `ads.csv`, `daily_adset.csv`, `funnel.csv` optional. Same POAS assumptions (A1–A5/A7), configurable COGS/shipping defaults, status/step validation, missing-file warnings, graceful degradation. Verified by round-trip: synthetic JSON → CSVs → re-ingest reproduces every headline figure (80k spend, 3.49× ROAS, 1.19× POAS).
- **In-browser**: `/upload` page — five named CSV slots, Papa Parse client-side, validation errors/warnings shown inline, computed in-browser via `lib/compute.ts` (twin of the Python script). Files stay in the browser; nothing is uploaded anywhere. Brand name + fallback cost inputs.
- Frame availability degrades honestly: missing `funnel.csv` → Frame 2 unlock state; missing `ads.csv` → Frame 4 unlock state; missing `daily_adset.csv` → Frame 5 unlock state.

### 8.2 Frame 4 linkage gate
Per-ad profit/POAS renders only when `orders.csv` carries `ad_id` (real order↔ad linkage). Without it, Frame 4 shows a locked state explaining the missing join and the production fix (click-ID/UTM stitching) — never allocates ad-set profit to ads by spend share.

### 8.3 Deterministic reasoning (Level 1, default)
`lib/diagnose.ts` replaces hardcoded diagnosis text:
- **ROAS-drop detector**: scans daily data per ad set, largest first-half vs second-half decline ≥10% triggers the case; evidence decomposition (CPC/CTR flat vs AOV down vs failed-delivery up); culprit = worst-flagged creative (zombie/fatigue); generated trigger/diagnosis/action. No qualifying drop → honest "no sharp drop" state.
- **Funnel-leak detector** (`lib/funnel.ts` shared): per-channel, per-transition slip detection vs prior window; EGP impact = lost purchases × AOV; worked case = biggest leak.
- **Findings ranking** (Frame 1): money-slide offenders, leaks, and ROAS drops ranked by EGP impact with cross-frame links.
- **Gap checklist** (`data/gaps.json`): heuristic recover-now / fix-the-cause checklists for the three middle-funnel stages, labeled as heuristic (data pinpoints *where*, not *why*). Sources tagged: data / inspection / input.

### 8.4 AI Analyst toggle (Level 2, opt-in BYOK)
Floating toggle (bottom right). Off by default — the demo is fully useful without it. When on with a user-supplied key: `lib/llm.ts` sends governed computed metrics (never raw order rows) to an OpenAI-compatible chat-completions endpoint with a prompt that forbids invented numbers; the diagnosis block shows "✨ Written live by AI", falls back to the rules version on any failure, and never persists the key. Live mode needs a served page (http://), not double-clicked file:// — the deterministic demo works either way.

### 8.5 Honest-boundary changes
- Data badge is dynamic: "SAMPLE DATA — fictional brand" vs "MERCHANT DATA — computed from your CSVs".
- Provenance labels on diagnoses: "Rules-generated" vs "✨ Written live by AI" vs "rules-detected".
- Frame 4 moved from `/frame-4/[adsetId]` dynamic route to `/frame-4?adset=<id>` so CSV-provided ad-set IDs work in the static export; `fix_file_paths.py` updated to rewrite the query-param links for file:// viewing.

---

## 9. v05 addendum (2026-10-11) — the investigation pipeline

Restructured from the 6-frame pitch deck into the pipeline a performance marketer actually follows: **Detect → Isolate → Diagnose → Decide → Verify**. The demo no longer presents solved cases; the marketer works them, with the Analyst narrating every step. This is the Agentic Intelligence Layer made visible as the product's feel.

### 9.1 Routes
- `/` — repositioned home: "Don't read your numbers. Work the case." Plus the ecosystem strip (Vondera apps → Analytica → VPal/apps), speaking to both the CEO and marketers.
- `/detect` — morning triage: blended ROAS vs true POAS hook cards + ranked case feed (every alert is a case, ranked by EGP). Calm state when nothing moved.
- `/case?case=<id>` — the investigation: stepper + Isolate / Diagnose / Decide stages with back/next. Detect summary on entry; Verify via the watchlist.
- `/verify` — the watchlist: approved cases monitored for recovery. The loop most dashboards never close; in the demo it's local state, labeled as such.
- `/upload` — unchanged purpose, hardened (see 9.4).
- Old `/frame-*` routes retired.

### 9.2 Cases (`lib/cases.ts`)
One case model for all three alert kinds (roas-drop, funnel-leak, money-offender), built from the detectors and ranked by impact. Per-kind evidence layers for the Diagnose stage — each layer rules something out (click-to-peel). Money-offender cases get a margin decomposition from the new per-adset economics (revenue / COGS / shipping / failed-delivery burn), so "why does 2.9× ROAS lose money" is answered with numbers, not prose.

### 9.3 Agentic narration (`lib/narrate.ts`, `analystNarrate`, `AnalystNote`)
Every stage gets the Analyst's voice: deterministic rules text by default ("I scoped it…", "I peeled the layers…"), re-verbalized live when the AI toggle is on. Same governance as diagnosis — computed metrics in, verbalization out, fallback to rules on failure with a visible note. Provenance badges: "rules" vs "✨ live".

### 9.4 Real-data hardening
- Per-adset `economics` added to the data contract (`types.ts`, `compute.ts`, `ingest_csvs.py`, `generate_data.py`); sample data regenerated — headline figures unchanged (3.49× / 1.19× / 2.92×), economics reconciles to profit per ad set.
- CSV parser: strips UTF-8 BOM, lowercases/trims headers, skips blank rows, warns on duplicate columns, reports row counts per file in the uploader.
- Decide-stage approval writes to a local watchlist (resets on dataset change); execution remains honestly mocked ("in production this queues via the ecosystem").

### 9.5 What the static prototype still can't do
Live data refresh, scheduled anomaly alerting, real action execution, multi-merchant workspaces, true order↔ad stitching beyond the CSV column. v05 is the ceiling of the static approach — the remaining open question is validation with a real merchant export.

## v05 rebuild (2026-10-11, same version) — single-page conversion

**Why:** real-browser QA on `file://` exposed that Next.js client-side routing is
fundamentally broken without a server: the App Router fetches the RSC payload via
`fetch()`, which CORS blocks from origin `null`; its fallback hard-navigates to the
route path (`file:///detect/`) instead of the rewritten `detect/index.html`. Every
in-demo "link" died on a double-clicked build. This affected all previous versions —
it was never caught because verification inspected HTML, never clicked.

**Change:** the demo is now one page (`out/index.html`). Routes became in-memory
views (`components/ViewHome/ViewDetect/ViewCase/ViewVerify/ViewUpload.tsx`) switched
by a tiny view router in `components/Shell.tsx`. No `next/link`, no `useRouter`,
no `useSearchParams` anywhere. Consequences:
- The page never reloads, so CSV data, watchlist, and the API key survive navigation
  (previously a full reload would have wiped them — the SPA fixes this class of bug
  by construction).
- `assetPrefix: './'` added to `next.config.js` so the JS runtime resolves `_next/`
  chunks relatively (the runtime hardcodes `"/_next/"`, which HTML rewriting can't
  reach). `fix_file_paths.py` also handles `_next` refs inside JSON-escaped attrs.
- AI toggle is now a compact circular ✨ FAB (was a wide pill that covered CTAs);
  the SAMPLE DATA badge moved into the header flow (was a fixed overlay covering
  nav buttons); footer gained bottom clearance above the FAB.

**Verified:** scripted Playwright walkthrough on `file://` — home → detect (4 cases)
→ isolate → diagnose (all layers peeled) → decide → approve → verify watchlist →
upload → nav round-trip with watchlist intact → toggle dialog open/cancel — zero
page errors, zero failed requests. Screenshots reviewed for each stage.
