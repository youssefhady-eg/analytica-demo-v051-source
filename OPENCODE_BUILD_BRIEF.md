# Analytica demo — OpenCode build brief (v05.1 → v06)

**Read this whole file before touching code.** Then read `BUILD_SPEC.md` (repo root) and `analytica-ux-wireframes-v01.html`. This brief supersedes the BUILD_SPEC non-goal "no AI Analyst chat" (the mock Ask panel in Phase 5 is in scope) and nothing else in it.

---

## 0. Mission and audiences

Analytica is a clickable product demo of an "Agentic Intelligence Layer" for e-commerce marketers: **Detect → Isolate → Diagnose → Decide → Verify**, narrated by an Analyst. It runs as one double-clickable `out/index.html`, no server.

It must win over **two audiences in the same build**:

| Audience | What they judge | What the demo must show them |
|---|---|---|
| **Vondera decision-maker** | Strategy and fit: is this a product Vondera should back? | The ecosystem story (Vondera apps → Analytica → VPal/apps), honest boundaries, a polished presenter-led walkthrough, recommendations-only posture |
| **Performance marketers** | Workflow: *would I open this every morning?* | Money-ranked triage, real investigation steps, a Dismiss flow that learns from them, usable on a phone, works on their own CSVs |

"Exceptional" means: it never lies, never dead-ends, never breaks on `file://`, reads well on a phone, and can be presented by someone who has 10 minutes and one laptop.

---

## 1. Non-negotiable constraints (apply to every phase)

1. **Static export must work from `file://`.** `npm run build` → open `out/index.html` directly in a browser. No `next/link`, no `useRouter`, no `useSearchParams`, no client-side data fetching, no API routes. Views switch in memory via `components/Shell.tsx`.
2. **The only network call allowed** is the user-initiated BYOK LLM request in `lib/llm.ts`. Nothing else may call `fetch`/XHR/WebSocket. Do not load fonts, scripts or images from a CDN.
3. **No browser storage.** No `localStorage`, `sessionStorage`, `IndexedDB`, cookies. All state lives in React state and is lost on reload. (Downloads via `Blob` + `<a download>` are fine.)
4. **Rules narration is the default.** The AI toggle stays **bring-your-own-key, never persisted**; the key exists only in `AnalystProvider` React state. Live mode sends governed computed metrics only, never raw rows, and always falls back visibly to the rules text.
5. **Recommendations only.** The product never claims to execute anything on a merchant's behalf. Keep the "in production this queues via the ecosystem" honesty footnotes. The Ask panel must not offer to perform actions.
6. **Honesty is a feature.** Every fallback, sample number, heuristic and mocked element stays labeled. The data badge (SAMPLE DATA / YOUR DATA) is visible on every screen. Never show "all quiet" or "no problems" when a detector could not run.
7. **No invented numbers.** Every figure in UI copy, tour captions and chat answers comes from computed data (`lib/*`) via template strings. Never hardcode a figure into copy.
8. **Sample headline numbers must not change:** spend EGP 80,000; platform ROAS 3.49×; true POAS 1.19×; overstatement 2.92×. Do not edit `data/*.json` or `generate_data.py` unless a phase says so.
9. **Form rules (from BUILD_SPEC §6):** casual register, plain words, EGP formatted `en-EG`, **no COD framing**, no unexplained jargon.
10. **Dependencies:** keep the stack (Next 14, React 18, Tailwind 3, ECharts, Papa Parse). New runtime dependencies are not allowed. Dev-only additions (Playwright, Vitest, tsx) are allowed.
11. **Do not guess the Vondera API or export schema.** Where a real Vondera export shape is needed (Phase 6), build a single editable alias map and leave a clearly marked `TODO(real-export)` — the owner will supply real files.

---

## 2. Repo orientation (v05.1)

```
app/                         # Next.js project root (run commands here)
  app/layout.tsx, page.tsx, globals.css
  components/
    Shell.tsx                # single-page view router: home | detect | case:<id> | verify | upload
    SiteNav.tsx, DataBadge.tsx, Stepper.tsx, AnalystNote.tsx, AiToggle.tsx (✨ FAB + key dialog)
    ViewHome / ViewDetect / ViewCase / ViewVerify / ViewUpload .tsx
    DataProvider.tsx         # data (sample|csv), watchlist, watch/unwatch
    AnalystProvider.tsx      # AI toggle state, BYOK key (memory only)
    AdTable, FunnelChart, TrendChart, Sparkline, ui.tsx (dark primitives)
  lib/
    cases.ts (buildCases/getCase/evidenceLayers/casePlan), diagnose.ts, funnel.ts,
    narrate.ts, llm.ts, compute.ts, csv.ts, metrics.ts, types.ts, format.ts, data.ts
  data/*.json                # sample dataset "Cairo Thread" (seeded)
  ingest_csvs.py, generate_data.py   # Python twins of compute.ts / the generator
fix_file_paths.py            # LEGACY from the route-based build — see Phase 0
BUILD_SPEC.md
```

**Sample-mode case list (ground truth for regression):**

| Rank | id | Kind | Impact |
|---|---|---|---|
| 1 | `leak-tiktok-3` | funnel-leak (TikTok Checkout → Purchase, 8.1% → 4.6%) | EGP 269,340/mo |
| 2 | `money-lookalike-purch` | money-offender (2.90× vs 0.82×) | EGP 24,000/mo |
| 3 | `money-tiktok-prosp` | money-offender, ✉ Sara (3.80× vs 0.81×) | EGP 16,000/mo |
| 4 | `drop-spring-broad` | roas-drop, ✉ Ahmed (−14%) | not sized |

---

## 3. How to work: phases with checkpoints

Work **one phase at a time**. At the end of each phase, **stop** and post a checkpoint report; do not start the next phase until the owner replies `approved: phase N`.

**Checkpoint report format (required):**
1. What changed (files, one line each).
2. Gate results (§4) with pass/fail per gate and command output tails.
3. Screenshots (paths) for every screen the phase touched, at the viewports listed in §4.
4. Deviations from this brief and why. Any new UI string not already listed in the brief.
5. Open questions (max 5).

Commit per phase with message `phase N: <name>` so any phase can be reverted alone.

| Phase | Name | Goal |
|---|---|---|
| 0 | Baseline & test harness | Prove the starting point; build the verification tooling |
| 1 | Audit fixes | Remove dead ends, false states and wireframe mismatches |
| 2 | Dismiss-reason flow | Wireframe §5 note 4, end to end |
| 3 | Mobile-first & accessibility pass | Usable on a 360 px phone; AA contrast |
| 4 | Guided presenter mode | Scripted walkthrough for both audiences |
| 5 | Ask Vondera panel (mock, rules-driven) | Conversational layer over governed metrics |
| 6 | Real-export hardening | Survive messy merchant CSVs; templates; parity tests |
| 7 | Docs sync | BUILD_SPEC addendum, wireframes v02 |

---

## 4. Verification gates (run at the end of every phase)

**G1 Build:** `cd app && npm run build` succeeds with no type errors.
**G2 file:// safety (static scan of `out/`):**
- `grep -rE 'src="/|href="/' out/*.html` returns nothing (no root-absolute asset refs).
- `grep -rnE "next/link|next/navigation|useRouter|useSearchParams|localStorage|sessionStorage|indexedDB|document\.cookie" components lib app` returns nothing.
- `grep -rn "fetch(" components lib app` returns only the two calls in `lib/llm.ts`.
**G3 file:// runtime:** a Playwright script (built in Phase 0) opens `file://<abs>/out/index.html`, walks the golden path (§5), and asserts zero `pageerror`, zero `console.error`, zero failed requests.
**G4 Invariants:** sample headline numbers and the §2 case table are unchanged (script `scripts/check-invariants.ts` from Phase 0).
**G5 Screenshots:** capture each touched screen at **360×740, 390×844, 768×1024, 1280×800**; save to `docs/shots/phase-N/`.
**G6 Honesty:** grep that no new copy contains a hardcoded EGP/× figure outside template literals fed by data.

---

## 5. Phase 0 — Baseline & harness

1. Run `npm install && npm run build`; record output size.
2. **`fix_file_paths.py` is a legacy of the old route-based build.** In v05.1 the export already has relative `./_next/` refs via `assetPrefix: './'`. Confirm by building *without* running the script. If the export is clean, delete the script and remove references to it; if not, keep it and make it a no-op sanity check.
3. Add devDependencies: `@playwright/test`, `tsx`, `vitest`. Add scripts: `verify:static` (G2), `verify:file` (G3), `verify:invariants` (G4), `verify` (all).
4. Write `scripts/golden-path.spec.ts`. Golden path on `file://`: Home → "Work a case" → open rank 1 → Isolate → "Diagnose →" → peel all layers → "Decide →" → "Approve plan" → "Open the watchlist →" → Verify shows the card → nav to Upload → nav back to Detect with the watchlist count intact → open ✨ dialog, then Cancel. Later phases extend this file.
5. Write `scripts/check-invariants.ts` asserting the §2 table and the four headline numbers by importing `lib/data` + `lib/cases`.
6. If a browser cannot be installed in your environment, say so in the checkpoint and ship G2/G4 plus the Playwright script untested, clearly marked.

**Checkpoint 0:** harness green on the untouched v05.1 source.

---

## 6. Phase 1 — Audit fixes

Each item has an ID, the v05.1 location (line numbers may drift slightly), and the required behavior. **Code wins** unless stated.

### 6.1 Honest states (highest priority)

**P1-01 · Handled cases leave the waiting list.** `ViewDetect.tsx` ignores the watchlist, so an approved case stays #1 "START HERE" and Home still says "N waiting" (`ViewHome.tsx:11,39`).
→ Compute a `waiting` list = cases not on the watchlist (and, after Phase 2, not resolved/snoozed). Detect ranks and numbers only `waiting`. Home's count uses the same selector. Put the selector in `lib/cases.ts` (`waitingCases(data, watchlist, dispositions)`) so there is one source.
→ New state **"All cases handled"** (distinct from "All quiet"): shown when cases exist but none are waiting. Primary action: "Open the watchlist →". "All quiet" is shown only when detectors ran and found nothing.
→ When approved cases exist, show one quiet link under the ranked list: `{n} on the watchlist →` (new string). No other layout change.

**P1-02 · Never claim "all quiet" when a detector didn't run.** `diagnose.ts:33` returns `null` without daily data; `funnel.ts:46-48` returns zero impact without ≥ 8 funnel dates; Detect then says "no sharp ROAS drops, no active funnel leaks" (`ViewDetect.tsx:70-77`).
→ Add `detectorStatus(data)` → `{ roasDrop: 'ran'|'skipped', funnel: 'ran'|'skipped', adLinkage: ... }` with reasons (`daily_adset.csv not loaded`, `funnel.csv has < 8 days`).
→ If any detector skipped, the Detect page shows a compact notice listing which checks were skipped and why, with an "↑ Load {file}" action. The all-quiet copy must name only the checks that ran.

**P1-03 · Stepper steps that do nothing.** `Stepper.tsx:33-34` renders clickable buttons for "done" Detect; `ViewCase.tsx:55-56` ignores them. → Detect pill returns to Detect (`onBack`). Verify pill is non-interactive until the case is approved, then goes to Verify. No clickable pill may be a no-op.

**P1-04 · Analyst note follows state.**
- Decide: after approve, the note must not say "Approve and I'll put this on the watchlist." Add `narrate('decide', c, data, { approved: true })` variant (new strings).
- Diagnose: the note must follow the peel. Pass `revealed`/`totalLayers`; before the first peel show a scoping line; after each peel, a one-line verdict for the newest layer; the full summary only when all layers are revealed. (Wireframe §4 note 1.) Applies to all three kinds. Live mode receives `layers_revealed` in the governed metrics.

**P1-05 · Upload failure states.** (`ViewUpload.tsx:57,148-155`)
- Never title the warnings card "Loaded with notes" when load failed. Titles: `Couldn't load` (errors), `Loaded with notes` (success + warnings), `Loaded` (success, none).
- Row counts become **per-file inline** next to each file slot after parse (`✓ 1,204 rows`), not warnings (wireframe §7 note 2).
- If a re-run fails, say explicitly: "Still showing your previous data — this attempt didn't load." Do not leave the old data active silently.
- Add a clear success banner with the headline figures (spend, ROAS, POAS) computed from the loaded data.

### 6.2 Navigation and dead ends

**P1-06 · Verify cards link to their case** ("Open case →"). "Stop watching" gets a two-step confirm (inline, no modal), and after unwatching the case returns to the waiting list.
**P1-07 · Isolate gets a quiet "← Back to triage"** at the bottom-left (wireframe §3 note 4: Back is quiet). Reuse `onBack`.
**P1-08 · AI FAB behaviour matches the wireframe.** FAB always opens the Analyst dialog. The dialog shows key/endpoint/model, an on/off switch, and **"Disconnect (clear key)"**. Add `aria-label`, `aria-pressed`, `title`. Dialog: `role="dialog" aria-modal`, Esc closes, backdrop click closes, focus moves in and is restored on close. The key still never persists.
**P1-09 · Isolate for "Profit lie" cases shows the margin decomposition** (wireframe §3): add a compact stacked breakdown (revenue → COGS → shipping → failed-delivery burn → profit) from `adset.economics`, above the creative table. Reuse existing card styles. This is the one planned layout addition to an existing screen.
**P1-10 · ROAS-drop cases have no money value** (`impactEgp: null`, sorts last). Do not invent a number. Render "impact not sized" on the card (new string) and keep the sort, with ties broken by severity (`dropPct`). Update the wireframe, not the data.

### 6.3 Wireframe reconciliation (docs, collected for Phase 7)

Record these as wireframe edits (do not change code for them): Detect rank 2/3/4 order (§2 table); Verify analyst note wording ("In production I'd check this metric daily…" is correct); Verify empty-state button and stepper; Diagnose composite (culprit card is ROAS-drop only, checklist is funnel-leak only; peel button hides when all layers are shown).

### 6.4 Cleanup
Delete `components/SampleBadge.tsx`, `viewKey` in `ViewShell.tsx`, and `caseAction` in `lib/cases.ts` if still unused.

**Checkpoint 1:** all P1-xx demonstrated in screenshots; golden path extended with: approve → return to Detect → case is not in the waiting list; skipped-detector notice with a funnel-less CSV fixture.

---

## 7. Phase 2 — Dismiss-reason flow (wireframe §5 note 4)

**Scope:** visual layer plus in-memory state. No copy changes to existing screens beyond the strings in §7.6. No layout shifts on existing screens beyond the in-place chip row and the one new log region (§7.4).

### 7.1 Interaction (Decide stage)

1. Pressing **Dismiss** replaces the Approve/Dismiss row **in place** (same container height — no layout shift) with: label `Why dismiss?`, three chips **Already handled / Not now / Disagree**, and a quiet `Cancel`.
2. Choosing a chip commits immediately and shows a confirmation state in place of the row:
   - the plan status pill changes (see §7.5),
   - one confirmation sentence (per reason, §7.6),
   - two actions: `Undo` and `← Back to triage`. No dead end.
3. Dismissal state lives in `DataProvider`, **not** in `DecideStage` local state, so it survives Back/Next, leaving the case, and re-entering it.

### 7.2 State model (`DataProvider`)

```ts
type Disposition =
  | { kind: 'resolved'; at: number; reason: 'already-handled' }
  | { kind: 'snoozed';  at: number; reason: 'not-now'; snapshot: WorseningSnapshot; resurfaced?: boolean }
  | { kind: 'override'; at: number; reason: 'disagree'; snapshot: WorseningSnapshot };

dispositions: Record<caseId, Disposition>
dismiss(caseId, reason), undoDisposition(caseId), simulateWorsening(caseId)
```

- `at` is `Date.now()` for ordering only; never displayed as a fake "date".
- `WorseningSnapshot` records the case's tracked metric at snooze time (§7.3).
- Dispositions reset when the dataset changes (same rule as the watchlist) **except** the same-brand CSV re-upload case below (D3).

### 7.3 Behavior per reason

| Reason | Effect on the hit-list | Effect elsewhere |
|---|---|---|
| **Already handled** | Leaves the waiting list permanently → appears in the **resolved log** | Counts toward "cases handled" in the all-handled state |
| **Not now** | Leaves the waiting list → appears in the log as **snoozed**. **Re-surfaces automatically if the tracked metric worsens** (not on a timer) | Re-surfaced card gets a `↻ Re-surfaced — worsened since snoozed` marker and an Analyst line |
| **Disagree** | Leaves the waiting list → appears in the log as **override**. The case is kept (not deleted) | Logged as a **human-override signal surfaced to the Analyst** (§7.7) |

**Tracked metric per kind (single function `worseningMetric(c, data)` in `lib/cases.ts`):**
- `funnel-leak` → the leak's `egpImpact` (higher = worse)
- `money-offender` → the ad set's `true_poas` (lower = worse)
- `roas-drop` → `dropPct` (higher = worse)

**Worsened** means worse than the snapshot by more than a tolerance constant `WORSEN_TOLERANCE = 0.02` (2% relative). Put the constant and `isWorsened(snapshot, current)` in `lib/cases.ts` with unit tests (Vitest): equal → false, 1% worse → false, 5% worse → true, better → false, missing metric → false.

**Demonstrating it honestly.** Sample and CSV data are static, so nothing worsens on its own. Add a clearly labeled demo control on each snoozed row in the log: `Simulate worsening (demo)`. It applies a synthetic overlay (`simulated[caseId] = factor`) that `worseningMetric` multiplies in — it must **not** mutate `data`. When the overlay makes `isWorsened` true, the case re-surfaces. The control is hidden in presenter "clean view" (Phase 4) unless the tour step needs it.

**D3 (same-brand CSV re-upload).** If the user loads a *newer* CSV for the **same brand name**, keep dispositions in memory and re-evaluate snoozed cases against fresh data — this makes re-surfacing real, not simulated. Switching brand or returning to sample clears them. (Default: on. Owner may veto at checkpoint 2.)

### 7.4 The log (new region — the only new surface)

A collapsed `<details>` at the bottom of **Detect**, titled `Handled & snoozed ({n})`, placed above the assumptions drawer. Hidden when `n = 0`. Rows reuse existing card styling:
- Resolved: muted, title + `resolved` chip + `Undo`.
- Snoozed: title + `snoozed` chip + the metric at snooze time + `Simulate worsening (demo)` + `Undo`.
- Override: title + `your override` chip + `Undo`.
Clicking a row title opens the case.

### 7.5 Pills (Decide plan header)

Reuse existing pill classes. `PENDING APPROVAL` (amber) · `APPROVED · WATCHING` (emerald) · `RESOLVED` (slate) · `SNOOZED` (slate) · `OVERRIDE LOGGED` (cyan). Replace the old local `DISMISSED` pill.

### 7.6 New UI strings (complete list — add no others without flagging)

`Why dismiss?` · `Already handled` · `Not now` · `Disagree` · `Cancel` · `RESOLVED` · `SNOOZED` · `OVERRIDE LOGGED` · `Undo` · `Handled & snoozed ({n})` · `resolved` · `snoozed` · `your override` · `↻ Re-surfaced — worsened since snoozed` · `Simulate worsening (demo)` · `{n} on the watchlist →` · `All cases handled` · `impact not sized`

Confirmation sentences (rules narration style, casual):
- Already handled: `Marked as handled — it's out of your triage list.`
- Not now: `Snoozed. I'll bring it back if the numbers get worse.`
- Disagree: `Noted — I've logged that you disagree with my read on this one.`

### 7.7 Human-override feedback → Analyst

- Detect Analyst note: when overrides exist, append `You've overridden {n} of my reads — I've logged them.` (rules text; new string).
- On a case with an override: the Decide-stage Analyst note appends `You disagreed with me on this one. I've kept your call.`
- Live mode: include `human_overrides: [{case_kind, case_title}]` and `snoozed_count` in the governed metrics for narration. Never include free text. The LLM prompt must not claim learning or retraining.
- Honesty footnote under the log: `Demo: overrides are kept in this page only. In production they feed the intelligence layer as training signal.`

### 7.8 Edge cases to handle

- Dismiss, then Back, then Decide again → the confirmation state persists.
- Approve a case that was snoozed → clears the disposition, goes to the watchlist.
- Undo restores the case to the waiting list at its original rank.
- A case whose id disappears after a dataset change → disposition is dropped silently.
- All cases dismissed → "All cases handled" state (P1-01), not "All quiet".

**Checkpoint 2 gate additions:** Vitest passes for `isWorsened` and the selector; golden path extended: dismiss with each reason → correct pill, correct list membership, Undo works, Back/Next preserves state; simulate-worsening re-surfaces the snoozed case with the marker.

---

## 8. Phase 3 — Mobile-first & accessibility pass

Design for **360 px first**, then enhance at `sm` (640), `md` (768), `lg` (1024). Tailwind only; no layout rewrites that change desktop behavior.

**P3-01 Header.** Collapse `SiteNav` to two rows max on phones: row 1 wordmark + data badge; row 2 a horizontally scrollable nav (`overflow-x-auto`, no wrap, snap). Active tab stays in view. "↑ Load your CSVs" stays visible in the scroller.
**P3-02 Stepper.** Below `sm`, render a compact `Step 2 of 5 · Isolate` bar with a segmented progress strip; tapping opens nothing — it is a status display. From `sm` up, keep the pills. No dangling arrows.
**P3-03 Detect cards.** Below `sm`, stack: rank + tags, title, detail, then the EGP figure and "Work it →" on their own row. Add `min-w-0` where text can overflow. Whole card remains the tap target.
**P3-04 Case navigation.** Below `md`, the Back/Next row becomes a **sticky bottom action bar** with `padding-bottom: env(safe-area-inset-bottom)`. Add `<meta name="viewport" ... viewport-fit=cover>` via Next metadata/`viewport` export. The AI FAB moves above the bar on case screens (offset by the bar height) so it never covers Approve/Next.
**P3-05 Tables.** `AdTable` and the ROAS/POAS table: keep horizontal scroll, add a right-edge fade and a `scroll →` hint on first view; the first column (name) is sticky. Below `sm`, `AdTable` renders as stacked cards (name, POAS, flags first; the rest in a `<details>`). Same data, same flags.
**P3-06 Charts.** ECharts: `height` 220 px below `sm`; legend at the bottom with `type: 'scroll'`; font sizes from a shared constant; call `resize` on container change.
**P3-07 Tap targets.** Every button/link ≥ 44×44 px hit area on touch (use padding, not font size). Applies to nav, stepper pills, chips (Phase 2), Verify actions, dialog buttons.
**P3-08 Contrast & type.** Replace `text-slate-600` for any *informational* text (footnotes, column hints, hints, the honesty footers) with `text-slate-400`; decorative arrows may stay. Nothing under 12 px for information (raise the `text-[11px]` mono labels that carry meaning to 12 px). Meet **WCAG AA 4.5:1**; add a script `scripts/contrast.ts` that checks the Tailwind color pairs used for text on `#070b12`/card backgrounds.
**P3-09 Focus & semantics.** Visible `focus-visible` ring (cyan) on every interactive element; real `<button>`s; headings in order; `aria-live="polite"` on the Analyst note region; `aria-label` on icon-only buttons; verdict layers get a text label (`OK`/`PROBLEM`) in addition to color; Sparkline gets a `role="img"` + `aria-label` ("trend: up/down").
**P3-10 Motion.** `prefers-reduced-motion`: disable `pulse-dot`, glow transitions, smooth scroll.
**P3-11 Forms.** Upload file rows: label above input on phones; numeric inputs use `inputmode="decimal"`.

**Checkpoint 3 gate additions:** G5 screenshots for every screen at all four viewports; automated check that no element causes horizontal page scroll at 360 px (`document.documentElement.scrollWidth <= innerWidth`) on every view; `scripts/contrast.ts` passes.

---

## 9. Phase 4 — Guided presenter mode

**Purpose:** let the owner present confidently to Vondera or a marketer without improvising, while the app stays fully real (no scripted fake data).

### 9.1 Behavior

- Entry: a `Present` button in the nav (new string) opens a **track picker** in a small dialog: **Vondera track** (ecosystem, product thesis, honesty, ~6 min) or **Marketer track** (workflow, investigation, Dismiss, own data, ~6 min).
- A **coach panel** docks bottom (phones) or right (desktop), never covering the highlighted target: step title, one-sentence caption, `Back` / `Next`, step counter, `Exit`. Keyboard: `→`/`←`/`Esc`.
- Each step **drives the real app** (navigates the view, sets the case stage, reveals layers, pre-expands the log) through a `TourProvider` that wraps `Shell` and exposes `go`, `setStage`, `peel`. Refactor `Shell`/`ViewCase` minimally to accept controlled state; normal (non-tour) behavior must be unchanged.
- Highlighting: add `data-tour="<id>"` attributes to targets and draw a spotlight ring with CSS `outline`/`box-shadow` on the target (no layout change; respects reduced motion). If a target is absent, the step still shows its caption and does not crash.
- **Presenter notes:** each step has a collapsed `Notes` section with talking points (owner-facing). A `Clean view` toggle hides the notes and the demo-only controls.
- Tour state is in memory. It must not alter data, the watchlist or dispositions **except** when a step explicitly performs the demo action (approve / dismiss); provide `Reset demo state` (clears watchlist, dispositions, tour) as the last step and in the panel menu.
- Works from `file://`, no network, no storage.

### 9.2 Step scripts (captions are templates; numbers come from data)

**Vondera track**
1. Home — *"Analytica turns Vondera's data into an investigation, not another dashboard."* Notes: product thesis; data in → intelligence → actions out.
2. Home ecosystem strip — *"Data in from Vondera apps, recommendations out to VPal and apps. Analytica diagnoses and proposes; the ecosystem executes."*
3. Detect hook cards — *"The platform says {roas}. After costs it earns {poas}. That's a {over} overstatement."*
4. Detect hit-list — *"{n} cases, ranked by money. The biggest is worth {topImpact} a month."*
5. Case → Diagnose (peel) — *"The Analyst rules things out one layer at a time — and says what it found."*
6. Decide → Approve → Verify — *"The loop most dashboards never close: approve, then watch whether it worked."*
7. Provenance — *"Every line is tagged `rules` or `✨ live`. Nothing is hidden, and no live model is needed to see value."*
8. Upload — *"Everything is computed in the browser. Nothing leaves the machine."*
9. Ask panel (Phase 5) — *"Ask questions in plain words — answered only from governed metrics."*
10. Reset demo state.

**Marketer track**
1. Detect — *"Start where the money is: {topTitle}."*
2. Open the case → Isolate — *"Scope it before you diagnose it."*
3. Diagnose, peel layer by layer.
4. Decide — *"A sequenced plan: what first, what next, what to re-measure."*
5. **Dismiss → Not now** — *"Not ready? Snooze it. It comes back if the numbers get worse."* → show the log → `Simulate worsening (demo)` → re-surfaces.
6. **Dismiss → Disagree** on another case — *"Think I'm wrong? Say so. It's logged for the Analyst."*
7. Verify.
8. Upload your own CSVs (offers `Download template CSVs`, Phase 6).
9. Mobile — *"Same flow on a phone."* (Notes: open on a phone.)
10. Reset demo state.

Put the scripts in `lib/tour.ts` as typed data (`{ id, track, view, stage?, target?, caption: (ctx) => string, notes }`). Captions are functions of the computed context.

**Checkpoint 4 gate additions:** Playwright runs both tracks end-to-end on `file://` with zero errors; exiting mid-tour leaves the app usable; Reset returns the app to the initial state; tour works at 360 px.

---

## 10. Phase 5 — Ask Vondera panel (mock, rules-driven)

**Purpose:** show the conversational layer honestly: it answers from governed computed metrics, with provenance, and says "I can't" when it can't.

### 10.1 UX

- An `Ask` button in the nav opens a **right drawer** (desktop) / **bottom sheet** (phones). A visible badge: `demo · answers from computed metrics`. Never imply it queries Vondera live.
- Input + **suggested-question chips** (computed from state, e.g. only shows "What did I approve?" when the watchlist is non-empty).
- Each answer carries a provenance badge (`rules`, or `✨ live` in BYOK mode), a short **"Answered from: …"** line naming the metrics used, and 1–2 follow-up chips. Answers that reference a case include `Open case →`.
- No chat history persistence. `Clear` button.
- Never offers to take an action. If asked to (e.g. "pause that ad"), answer: `I can recommend, but I don't take actions on your behalf — here's what I'd do:` followed by the case plan.

### 10.2 Rules engine (`lib/ask.ts`)

Deterministic intent matcher (keyword + simple normalization, English only for v1; leave an `i18n` seam). Intents:

| Intent | Example | Answer source |
|---|---|---|
| focus | "Where should I focus?" | `waitingCases` top item + impact |
| lie | "Which ad sets lose money?" | money-offender cases, true POAS |
| leak | "Why is TikTok checkout leaking?" | funnel case, rates, evidence layers |
| drop | "Why did Spring Broad ROAS drop?" | `detectRoasDrop` layers |
| profit | "What's my real ROAS?" | blended ROAS/POAS/overstatement |
| status | "What did I approve / snooze / dismiss?" | watchlist + dispositions |
| compare | "Meta vs TikTok?" | funnel rates per channel |
| help | anything unmatched | fallback |

Fallback copy: `I can only answer from the metrics on screen. Try one of these:` + chips. Never guess. If data needed by an intent is missing (e.g. no funnel file), say which file unlocks it.

### 10.3 Live mode

If the AI toggle is on with a key, route the question through the same BYOK path with the **governed metrics bundle only** (case list, headline numbers, dispositions summary — no raw rows). The system prompt forbids invented figures and action claims. On any failure, fall back visibly to the rules answer with the existing "Live … failed — showing the rules version." note. Reuse `lib/llm.ts`; add `analystAsk()` there (this is a third call site of the same `fetch` — update the G2 allowlist accordingly).

**Checkpoint 5 gate additions:** Vitest table tests: every intent returns text whose numbers are all present in the input data (regex-extract numbers from the answer and assert membership); unmatched input hits the fallback; missing-data intents name the missing file; no answer contains the strings "I paused", "I executed", "done". Playwright: ask each chip, open a case from an answer, drawer closes with Esc.

---

## 11. Phase 6 — Real-export hardening

**Goal:** a merchant's real, messy export loads, or fails with a precise, fixable message.

**P6-01 Delimiters & encodings.** Auto-detect `,` `;` `\t` (Excel in Arabic/European locales exports `;`). Detect likely non-UTF-8 (replacement characters) and warn with a fix (`Re-save as CSV UTF-8`). Keep BOM stripping.
**P6-02 Numbers & dates.** Accept `1,234.50`, `1.234,50`, `EGP 1,234`, `1 234`, trailing `%`. Reject ambiguous values with the row number. Dates: ISO, `dd/mm/yyyy`, `yyyy/mm/dd`, ISO with time; normalize to ISO; report the format detected and warn when day/month order is ambiguous.
**P6-03 Header aliases.** One file `lib/aliases.ts`: `Record<canonicalColumn, string[]>` with generic aliases only (e.g. `spend`, `cost`, `amount_spent` → `spend_egp`). Header matching is case/space/underscore-insensitive. Add `// TODO(real-export): extend from real Vondera exports` and show the alias that was applied in the file's info line (`matched "Amount Spent" → spend_egp`).
**P6-04 Row-level validation.** Report problems with file, row number and value, capped at 10 per file plus a count of the rest. Three levels, visually distinct: **error** (blocks load), **warning** (loads, may distort), **info** (row counts, matched aliases).
**P6-05 Data-quality checks (warnings):** duplicate `order_id`; negative or zero order values; orders with `adset_id` not in `spend.csv` (show orphan % ); `ad_id` coverage % in `orders.csv` (below 80% → warn that per-ad profit is partial, and say what is excluded); funnel dates < 8 (feeds P1-02); spend ≈ 0; date ranges that don't overlap across files.
**P6-06 Scale.** Handle ≥ 200k order rows without freezing: parse with Papa `chunk`/`worker` (workers must work from `file://` — if blob workers are blocked, fall back to chunked main-thread parsing with `setTimeout` yields). Show a progress bar and make **Compute** cancellable.
**P6-07 Template CSVs.** `Download template CSVs` button: generates the five template files with correct headers and 3 sample rows each from the sample data, via `Blob` + `<a download>` (must work from `file://`). One extra `Download sample as CSVs` that exports the full sample dataset so users can round-trip.
**P6-08 Parity & fixtures.**
- `fixtures/` with: clean export, semicolon-delimited export, comma-decimal export, orders missing `ad_id`, funnel with 5 days, duplicate orders, orphan adset ids, BOM + blank rows.
- Vitest: round-trip (sample → CSV → parse → compute) reproduces **80,000 / 3.49× / 1.19× / 2.92×**.
- Parity test: for the same fixture, `lib/compute.ts` and `ingest_csvs.py` produce equal headline numbers within 1e-6 (invoke Python from the test; skip with a visible message if Python is unavailable).
**P6-09 Privacy copy stays true.** Nothing is uploaded; the "Nothing is uploaded anywhere" line is verified by G2 (no network calls).

**Checkpoint 6 gate additions:** all fixtures behave as specified; error messages name file + row; large-file synthetic test (generate 200k rows in a script) completes with UI responsive (Playwright asserts the progress UI appears and the app accepts a click during parse).

---

## 12. Phase 7 — Docs sync

1. Append a **v06 addendum** to `BUILD_SPEC.md`: Dismiss flow, handled-state selectors, detector status, presenter mode, Ask panel, hardening, mobile pass, the superseded "no chat" non-goal, the retired `fix_file_paths.py` (if retired).
2. Produce `analytica-ux-wireframes-v02.html`: apply §6.3 edits; add wireframes for the chip row, confirmation state, the log, the snoozed/re-surfaced states, the "All cases handled" and "skipped detector" states, the Ask drawer, the presenter coach panel, and **mobile (360 px)** frames for Detect, Case and Verify. Fix the "v05"/"v01" version labels. Replace the footer's "verified N/N claims" with a number generated by `scripts/wireframe-claims.ts` (a checklist of claim → assertion → pass/fail) so the claim count is real.
3. README: how to run, build, verify, present.

---

## 13. Owner decisions (defaults assumed — confirm at the relevant checkpoint)

| ID | Decision | Default |
|---|---|---|
| D1 | Approved cases leave the waiting list (appear on Verify) | Yes |
| D2 | Resolved/snoozed/override log lives as a collapsed section at the bottom of Detect | Yes |
| D3 | Same-brand CSV re-upload keeps dispositions and re-evaluates snoozes | Yes |
| D4 | "Simulate worsening (demo)" control exists, hidden in Clean view | Yes |
| D5 | Worsening tolerance | 2% relative |
| D6 | ROAS-drop cases stay unsized ("impact not sized") rather than getting an estimated EGP value | Yes |
| D7 | Ask panel is English-only in v1 | Yes |
| D8 | Real Vondera export aliases are added later from real files | Yes |

---

## 14. Final acceptance checklist (v06)

- [ ] `npm run build` clean; `out/index.html` opens from `file://` and the golden path plus both tour tracks run with zero errors.
- [ ] G2 scans clean; the only `fetch` calls are in `lib/llm.ts`; no browser storage anywhere; API key lives only in React state.
- [ ] Sample headline numbers and the §2 case table unchanged.
- [ ] No dead-end click anywhere (stepper, Verify cards, Dismiss, upload failure).
- [ ] No false "all quiet"; skipped detectors are named; "All cases handled" exists.
- [ ] Dismiss: three reasons behave per §7.3; state survives navigation; Undo works; overrides reach the Analyst note and live-mode metrics.
- [ ] 360 px: no horizontal page scroll on any view; tap targets ≥ 44 px; AA contrast; FAB never covers a primary action.
- [ ] Presenter mode: both tracks complete; Reset works; Clean view hides notes and demo controls.
- [ ] Ask panel: every intent answers only from data; honest fallback; no action claims.
- [ ] Hardening fixtures pass; round-trip reproduces the headline numbers; template CSVs download from `file://`.
- [ ] Docs synced; wireframes v02 claims are generated, not asserted.

---

## Appendix A — Audit findings → phase map

| Finding (v05.1) | Location | Phase |
|---|---|---|
| Handled cases stay in the hit-list; Home count never drops | `ViewDetect.tsx` (no watchlist read), `ViewHome.tsx:11,39` | 1 (P1-01) |
| Dismiss is local state, lost on Back; no undo; no next action; stale Analyst note | `ViewCase.tsx:302,313,332-341`, `narrate.ts:74` | 2 |
| False "All quiet" when detectors skipped | `ViewDetect.tsx:70-77`, `diagnose.ts:33`, `funnel.ts:46-48` | 1 (P1-02) |
| Stepper pills that do nothing | `Stepper.tsx:33-34`, `ViewCase.tsx:55-56` | 1 (P1-03) |
| Analyst note doesn't follow approval / peel | `ViewCase.tsx:118-123`, `narrate.ts` | 1 (P1-04) |
| Upload: wrong heading on failure, stale data, row counts as warnings | `ViewUpload.tsx:50-57,148-155` | 1 (P1-05), 6 |
| Verify cards don't link back; no confirm on Stop watching | `ViewVerify.tsx:43-76` | 1 (P1-06) |
| Isolate has no Back | `ViewCase.tsx:135-139` | 1 (P1-07) |
| FAB can't reopen dialog; dialog a11y | `AiToggle.tsx:14-89` | 1 (P1-08), 3 |
| Profit-lie Isolate lacks margin decomposition | `ViewCase.tsx:181-210` | 1 (P1-09) |
| ROAS-drop sorted last with no value | `cases.ts:88` | 1 (P1-10) |
| Honesty footnotes at ~2.6:1 contrast (`text-slate-600`) | `ViewCase.tsx:347`, `ViewUpload.tsx:109,173`, `ViewHome.tsx:67`, `Shell.tsx:50`, `ViewDetect.tsx:164` | 3 (P3-08) |
| Mobile: 3-row header, cramped Detect cards, wrapping stepper, FAB over CTAs, 8-column table | `SiteNav.tsx:16-49`, `ViewDetect.tsx:84-136`, `Stepper.tsx:17`, `ViewCase.tsx:134-149`, `AdTable.tsx` | 3 |
| Color-only verdicts / sparkline | `ViewCase.tsx:237`, `Sparkline.tsx` | 3 (P3-09) |
| Dead code | `SampleBadge.tsx`, `viewKey`, `caseAction` | 1 (cleanup) |
