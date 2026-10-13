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

## [0.1.0]

- Initial static demo: Detect → Isolate → Diagnose → Decide → Verify, with
  client-side CSV parsing and an optional bring-your-own-key AI Analyst.
