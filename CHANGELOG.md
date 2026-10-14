# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Duplicate `order_id` rows were double-counted.** Profit, order counts and
  economics included every occurrence, contradicting the "first occurrence
  counted" warning. Both producers now skip repeats: `app/lib/compute.ts` and
  `app/ingest_csvs.py`. Covered by a new unit test, a new parity test, and the
  `orders-duplicates.csv` fixture.
- `AdTable` called `useState` after early returns, changing hook order when
  per-creative data loaded. The hook now sits above the returns.
- Two type errors that Next 16's build now type-checks: `lib/csv.test.ts`
  imported `CsvTables` from `./csv` (it lives in `./types`), and
  `scripts/hardening.spec.ts` passed its per-test timeout as a third `test()`
  argument, which Playwright ignores — now `test.setTimeout(180000)`.
- `react-hooks` findings surfaced by the newer plugin in ESLint 9: the tour
  provider's callback refs are written in an effect instead of during render,
  and `CoachPanel` resets its "More" toggle by remounting on step change.

### Added

- Route error boundaries (`app/error.tsx`, `app/global-error.tsx`) so a render
  error shows a recovery panel instead of white-screening a live demo.
- Unit tests for `lib/llm.ts` (governed payload + auth) and `lib/narrate.ts`
  (deterministic copy), plus `parseCsvLarge` coverage.
- ESLint (`next/core-web-vitals`), Prettier, and `.editorconfig`.
- Coverage tooling: `npm run test:coverage` (v8, scoped to `lib/**`).
- CI workflow (`.github/workflows/ci.yml`): test, lint, build and verify.
- Dependabot config and CODEOWNERS.
- CONTRIBUTING.md and SECURITY.md.

### Changed

- Removed dead code: `analystDiagnose` and `AnalystProvider.ask`.
- Pinned Node via `engines` and `app/.nvmrc`.
- **Dependency upgrades (combined Dependabot set).** Next 15 → 16, React 18 →
  19 (see below), ESLint 8 → 9 with a flat `eslint.config.mjs` (Next 16 removed
  `next lint`, so `npm run lint` now calls ESLint directly), Tailwind 3 → 4 via
  `@tailwindcss/postcss` (the PostCSS plugin moved out of the `tailwindcss`
  package; `autoprefixer` is no longer needed), Vitest 4 → 5, `@types/node`
  20 → 26, and the CI `actions/checkout`/`actions/setup-node` bumps.
- **React 19 enabled by dropping the dead `@tremor/react` dependency.** Tremor
  was only referenced by a stale Tailwind `content` glob; no source file
  imported it — `components/ui.tsx` provides the drop-in primitives. With it
  gone (and `echarts-for-react`, which peers `react >=16`, already React
  19-ready) React 18 → 19 is unblocked.

## [0.1.0]

- Initial static demo: Detect → Isolate → Diagnose → Decide → Verify, with
  client-side CSV parsing and an optional bring-your-own-key AI Analyst.
