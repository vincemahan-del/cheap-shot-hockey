# Cheap Shot Hockey

A fake hockey equipment store (Next.js on Vercel) used to demonstrate a
**mabl-driven agentic development lifecycle**: a coding agent writes the change,
mabl verifies the running preview, deterministic CI jobs gate on mabl's results,
and a human approves every merge.

**Live:** https://cheap-shot-hockey.vercel.app · **Architecture:**
[`docs/REFERENCE-ARCHITECTURE.md`](docs/REFERENCE-ARCHITECTURE.md)

## The pipeline in one screen

| When | What runs | Gate |
|---|---|---|
| Developer, before the PR | `/ship TAMD-N` (Claude Code + the mabl skills plugin): implement → mabl test impact → edit tests on a mabl branch named after the git branch → local mabl run (0 credits) → human "go" | — |
| Every PR (`ci.yml`) | `lint`, `unit`, `build`, `dependency-review`, `CodeQL` | required |
| | `mabl-smoke`: `CSH-SMOKE-PR` on **this PR's** Vercel preview | required |
| | `mabl-impact`: mabl test impact analysis picks the existing tests the change reaches and runs them on the preview; sticky PR comment | required (`test-impact-gate-exempt` waives) |
| | `human-approved`: a maintainer applies the label | required |
| Merge to `main` (`postdeploy.yml`) | Vercel deploys production; `CSH-SMOKE-POSTDEPLOY` runs on that exact build by its unique URL | — |
| Nightly (`nightly.yml`) | Full `type-rt` regression locally on the runner against prod (0 credits); local failures re-run once in the cloud for mabl's failure analysis | — |

Repo variable `MABL_CLOUD_GATE=disabled` pauses every mabl cloud run (the jobs
report "paused" in their summary).

## The app

| Surface | Notes |
|---|---|
| `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/orders`, `/account` | Storefront; guest checkout is supported |
| `/admin` | Admin orders + CSV export (not linked from nav) |
| `/deployments` | Deployment-status polling demo surface |
| `/api/*` | JSON REST API; OpenAPI 3.1 at `/api/openapi`; `/api/build-info` reports the running commit |

Every interactive element carries a `data-testid`. Seeded demo accounts:
`demo@cheapshot.test` / `demo1234` (customer), `admin@cheapshot.test` /
`admin1234` (admin).

## Run it

```bash
npm ci
npm run dev
```

```bash
npm run lint && npm test && npm run build
```

Data: Postgres (Neon) for users and orders; carts and recent guest orders live
in cookies because Vercel's serverless instances don't share memory.

## Also in this repo

- `docs/DELINEA-ROTATION-POC.md` — credential-rotation proof of concept
  (`scripts/delinea/`, test-only API routes that 404 unless `TEST_SEED_TOKEN`
  is set).
