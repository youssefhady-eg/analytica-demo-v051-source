# Analytica demo (v06)

Clickable product sample of an "Agentic Intelligence Layer" for e-commerce
marketers: **Detect → Isolate → Diagnose → Decide → Verify**, narrated by an
Analyst. One double-clickable page, no server, no backend. Sample headline
figures never move: spend EGP 80,000 · platform ROAS 3.49× · true POAS 1.19× ·
overstatement 2.92×.

## Run it

- **Review build (the graded artifact):** `cd app && npm run build`, then
  double-click `app/out/index.html`. Must work from `file://` with no server.
- **Dev mode:** `cd app && npm run dev` → `http://localhost:3000`
  (use `npm.cmd` on Windows if plain `npm` is execution-policy blocked).

## Verify it

```powershell
cd app
npm run verify    # static scan → invariants → file:// golden path → 360px no-overflow → both tour tracks → ask panel → hardening fixtures → contrast
npm test          # Vitest unit (cases, ask engine, csv hardening)
```

 phase checkpoints live in chat history; per-phase evidence (screenshots) is
 under `app/docs/shots/phase-N/`; harness scripts live in `app/scripts/`.

## Present it

- Click **Present** in the nav → pick the **Vondera track** (ecosystem thesis)
  or the **Marketer track** (daily workflow). `Next`/`Back` (or `→`/`←`,
  `Esc` exits) drives the real app through scripted, data-computed captions.
- **Reset demo state** (panel menu, and the last step of each track) restores
  the untouched sample.
- Live narration is bring-your-own-key only (✨ button): the key lives in page
  memory, only computed metrics are ever sent, and everything falls back
  visibly to rules text. The Ask drawer discloses its exact send-bundle before
  the first live call.

## Repo map

```
analytica-demo-v051-source/
  BUILD_SPEC.md                        # product spec + v06 addendum (§10)
  OPENCODE_BUILD_BRIEF.md              # phase briefs v05.1 → v06
  analytica-ux-wireframes-v0X.html     # v01 as-drawn, v02 as-built + mobile
  app/                                 # Next.js project root (run commands here)
    app/  components/  lib/  data/     # views, providers, engines, sample JSON
    scripts/                           # verify:* + *.spec.ts + fixtures/
    docs/shots/phase-N/                # per-phase screenshot evidence
```

## Data honesty rules (apply to every change)

Sample vs merchant data is always badged; fallbacks stay labeled; figures come
from `lib/*` computations, never prose; the product recommends, never claims
to execute; the only network call allowed is the user-initiated BYOK request
in `lib/llm.ts`. Never commit real merchant data.
