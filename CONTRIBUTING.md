# Contributing

Thanks for helping improve Analytica. This is a static Next.js demo — no
backend, no database — so the whole loop runs locally.

## Setup

```bash
cd app
npm ci
npx playwright install chromium   # only needed for the browser checks
```

Node 22+ is required — Vitest 5 and its `vite` dependency both require
`^22.12.0`. `app/.nvmrc` pins 22 and `app/package.json` declares
`engines.node >= 22`.

## Before you open a PR

Run the same gates CI runs:

```bash
cd app
npm test          # unit tests (vitest)
npm run lint      # eslint
npm run build     # static export must compile
npm run verify    # static scan, invariants, file://, mobile, tour, ask, hardening, contrast
```

`npm run verify` is the source of truth: it exercises the real app in a
browser and enforces the product invariants. A change is not done until it
passes.

## Conventions

- Formatting: Prettier (`npm run format`), lint: ESLint (`npm run lint`).
- The two producers of every metric — `app/lib/compute.ts` (browser) and
  `app/ingest_csvs.py` (offline) — must stay in lockstep. If you change one,
  change the other, and keep the parity test green.
- UI copy is part of the spec. Many strings are asserted by
  `app/scripts/wireframe-claims.ts`; changing them can fail `verify:static`.

## Reporting bugs / security

- Bugs: open a GitHub issue with steps to reproduce and the CSV fixture used.
- Security: see `SECURITY.md` — do not open a public issue.
