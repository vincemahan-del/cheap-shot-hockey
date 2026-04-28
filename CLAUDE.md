@AGENTS.md

# Claude context — cheap-shot-hockey

This file is the handoff brief for any Claude agent (CLI, GitHub app,
Agent SDK) working in this repo. Read it first before making changes.

## What this repo is

A **fake hockey e-commerce store** built as a live customer demo for
[mabl](https://www.mabl.com). It is intentionally full-stack (UI + API
+ OpenAPI spec + build-info endpoint + Jenkinsfile + GitHub Actions)
so a single URL can demonstrate mabl's value across the full SDLC.

**Live:** https://cheap-shot-hockey.vercel.app
**Workspace in mabl:** `pXXgThbNi4HfQOpiZptHfw-w` ("Cheap Shot Hockey Demo")
**CI:** Jenkinsfile runs on a local Jenkins; `.github/workflows/mabl-sdlc.yml`
is the GHA equivalent.

## Stack

- **Framework:** Next.js 16 App Router + React 19 + TypeScript
- **Styling:** Tailwind v4 + Archivo Black display font; dark theme
- **Deploy:** Vercel (auto-deploys from `main`)
- **Data layer:** in-memory singleton in `src/lib/store.ts` + cookie
  storage for cart (`src/lib/cart-cookie.ts`) and recent guest orders
  (`src/lib/order-cookie.ts`). **Carts and recent orders MUST stay in
  cookies** — Vercel's serverless instances don't share in-memory state.

## Key files

- `src/app/` — App Router pages and API routes
- `src/app/api/openapi/route.ts` — the OpenAPI 3.1 spec mabl imports
- `src/app/api/build-info/route.ts` — reports commit SHA / env / region
- `src/middleware.ts` — mints `csh_session` cookie, translates
  `?demo=<mode>` into an `x-demo-mode` header
- `src/lib/demo.ts` — implements slow/flaky/broken modes
- `src/components/*` — Nav, ProductCard, ProductThumb, CategoryTile,
  BrandRow, Footer, PromoStrip, DemoBanner, StarRating
- `public/product-photos/*.jpg` — real Wikimedia/Pexels photography
  (NOT AI — keep them real)
- `Jenkinsfile` — 8-stage SDLC pipeline (build → mabl API smoke → mabl
  UI PR gate → mabl regression → promote → post-deploy smoke)
- `scripts/mabl-deployment.sh` — POSTs to mabl `/events/deployment` and
  polls `/execution/result/event/<id>` with a 60s grace for no-plan-match
- `scripts/demo-toggle.sh` — flip prod into slow/flaky/broken
- `docs/SDLC-DEMO.md` — the 5-act customer runbook

## Conventions (don't break these)

- **`data-testid` attributes** are present on every interactive element
  for mabl selector stability. When you add a new UI element, add a
  `data-testid` that matches the pattern used nearby (e.g.
  `data-testid="add-to-cart-${productId}"`).
- **Demo credentials** are seeded in `src/lib/seed.ts`:
  `demo@cheapshot.test` / `demo1234` and `admin@cheapshot.test` / `admin1234`.
  Don't change them without updating `docs/SDLC-DEMO.md` too.
- **Demo mode toggles** live in a cookie (`csh_demo`) set by middleware
  from the `?demo=` query param. Values: `normal | slow | flaky | broken`.
- **Seed product data** is in `src/lib/seed.ts`. Keep brand names fake
  (Apex, Ironline, Glacier, Coldfire, etc.) so there are no real-brand
  conflicts with photography.
- **Guest checkout** is a first-class flow — `Order.userId` is nullable
  and `Order.guestEmail` fills in. Don't require auth for checkout.

## Build / test / deploy

```bash
npm run dev     # http://localhost:3000
npm run build   # Next.js production build (used by Jenkinsfile stage 2)
npm run lint    # eslint (currently optional — dropped from Jenkins stage)
```

Deploys are **automatic** on every push to `main` via Vercel. The
Jenkins pipeline mirrors a realistic customer CI flow — it does NOT
deploy, Vercel does; it only triggers mabl to gate.

## When Claude should push back

- **Don't replace real product photos with AI/SVG illustrations.** This
  was explicitly redone in commit 92e1574 — user called the SVGs "AI
  slop." Keep real photography.
- **Don't move cart/recent-orders back into the in-memory store.** That
  was the serverless bug we fixed in commit e080e6e. Cookies travel
  with the request; Lambda memory doesn't.
- **Don't require login for checkout.** Guest checkout is a demo
  feature.

## Definition of done (agentic — non-negotiable)

Before opening a PR or pushing a branch, Claude MUST run these steps in order:

**1. Unit coverage gate**
```bash
npm run test:coverage
```
If coverage drops below 90% on any metric, write the missing unit tests and re-run until green. Do not open the PR until this passes. Coverage is scoped to `src/lib/**` — UI and API routes are covered by mabl/newman.

**2. mabl test impact analysis**
```bash
git diff --name-only main | ./scripts/mabl-suggest-tests.sh
```
Review the output. If existing mabl tests match the changed files:
- Note them explicitly in the PR description under a "Test impact" section
- Add a Jira comment listing the affected tests so QA can verify

**3. mabl coverage gap check**
If the change adds new UI flows, pages, or API routes that have no existing mabl test coverage:
- Use the mabl MCP: `plan_new_test` → `create_mabl_test_cloud` (applicationId=`OZqmshBkUfVSesWy49g1eQ-a`, env=Preview)
- Cut a Jira ticket in TAMD to track the new test (link it to the feature ticket)
- Note the gap and the new ticket in the PR description

These three steps are what "done" means for this repo. The GHA `test-impact` job runs the same analysis automatically and posts results as a PR comment — Claude's pre-PR check and the CI job should agree.

## Common PR patterns the user will ask for

1. **"Add a <new feature>"** — add the page/component, keep
   `data-testid` naming consistent, update the OpenAPI spec if adding
   an API route, add a line in `docs/SDLC-DEMO.md` if it's demo-worthy.
2. **"Analyze this mabl failure"** — use the mabl MCP `analyze_failure`
   tool with the plan run id or link. Cross-reference against the
   `?demo=flaky|broken` toggle state to distinguish real regressions
   from simulated failures.
3. **"Draft a mabl test for X"** — use the mabl MCP `plan_new_test`
   then `create_mabl_test_cloud` with `applicationId=OZqmshBkUfVSesWy49g1eQ-a`
   and the appropriate env id.

## mabl workspace IDs (read-only reference)

```
MABL_WORKSPACE_ID    pXXgThbNi4HfQOpiZptHfw-w
MABL_APPLICATION_ID  OZqmshBkUfVSesWy49g1eQ-a
MABL_ENV_PROD_ID     vwf8Vni5e7H0XTfT5hbi6w-e
MABL_ENV_PREVIEW_ID  TpuarWvfj1hOREDT0JGvjA-e
MABL_ENV_LOCAL_ID    DmlIvADtF8jPDm9J7Bpshw-e
```

Plan labels Jenkins dispatches against: `api-smoke`, `pr-gate`,
`regression`, `post-deploy-smoke`.

## Custom Claude Code subagents

Three repo-level subagents in `.claude/agents/` codify the orchestration
patterns you'd otherwise re-prompt from scratch. Use the `Agent` tool to
delegate:

- **`demo-orchestrator`** — drives full ticket-to-prod for a small change
- **`pr-reviewer`** — convention audit on a PR (read-only)
- **`mabl-test-author`** — designs new mabl tests, tier-tagged

See `docs/CLAUDE-AGENTS.md` for examples + invocation patterns.

## Security + supply-chain gate

Three pieces, all advisory in v1 (not in the 5 required PR checks):

- **`npm audit --audit-level=high`** runs as the `security` job in
  `.github/workflows/mabl-sdlc.yml`, alongside `lint`. Job-level
  `continue-on-error: true` means it surfaces high/critical findings
  in the run summary without blocking the merge button.
- **CodeQL** runs as a separate workflow at
  `.github/workflows/codeql.yml` — on every PR + push to main, plus a
  weekly Monday cron. Uploads SARIF to the GitHub Security tab. Uses
  the `security-extended` query suite.
- **Dependabot** (`.github/dependabot.yml`) opens weekly dep-update
  PRs for npm (production app + recovery-agent) and `github-actions`.
  Each PR goes through the same SDLC pipeline as a human PR.

Promoting any of these to required-check status is a branch-protection
change (manual on the GitHub repo), not a workflow change. Document
that decision and the date it lands in this file when it happens.

## Plan-mode for high-blast-radius changes

Before opening a PR, the orchestrator subagent runs the deterministic
blast-radius detector at `scripts/orchestrator-plan/detect-blast-radius.js`.
It reads `git diff --numstat main` and flags `blast_radius: "high"`
when any of these are touched: `src/lib/auth*`, `src/lib/session*`,
`src/app/api/auth/**`, `src/app/api/openapi/**`, `mabl/postman/**`,
`.github/workflows/**`, `scripts/ci-notify.sh`, `scripts/recovery-agent/**`,
`scripts/orchestrator-plan/**`, `.claude/agents/**`, `evals/recovery-agent/**`,
`src/lib/store.ts`, `src/lib/seed.ts`, `src/lib/types.ts`, OR total
LOC delta exceeds 200.

When it fires, the orchestrator emits a structured plan in Jira
wiki-markup and posts it to the ticket via
`scripts/orchestrator-plan/post-plan.sh`. The human reviews the plan
in Jira, then replies *Approved* (or *Reject: <reason>*) to the
orchestrator in Claude Code. The orchestrator only proceeds to commit
+ push + PR after explicit approval.

This closes the *"AI just merges to prod?"* objection: high-risk
changes pause for a human checkpoint by deterministic rule, not by
prompt convention. Path-based v1; v2 (TAMD-108) extends to confidence
signals (open-question count, breaking-change detection, scope
assessment) — matching the pattern mabl uses internally for its 75-repo
agentic system.

## Failure-recovery agent (autonomous, narrow)

When `mabl CSH-SMOKE-POSTDEPLOY` fails on `main`, GHA triggers
`scripts/recovery-agent/index.js` — an Agent SDK `query()` loop
restricted to `Read`/`Grep`/`Glob` (no `Bash`, no `Edit`, no `Write`).
The agent reads pre-fetched diagnostic context from `./logs/`, emits a
structured JSON recommendation (revert / forward-fix / page-human), and
`scripts/recovery-agent/recommend.sh` posts that recommendation to
Slack + Jira via `ci-notify.sh`. The agent itself does not open PRs,
push commits, or transition tickets. Acting on the recommendation is a
human (or interactive Claude) job.

Requires `ANTHROPIC_API_KEY` repo secret. Without it, the job emits a
fail-safe `page-human` recommendation and exits.

## Ticket-to-prod demo narration

When the user is driving a ticket-to-prod demo and Claude should
narrate CI events (because `SLACK_WEBHOOK_URL` isn't set), follow the
canonical spec in `docs/MCP-NARRATION-PLAYBOOK.md`. Summary:

- **Channel:** `#vince-agentic-workflow-demos` (`C0A321B477Y`)
- **All messages at channel root, prefixed `[TAMD-XX]`** — Slack
  Workflow Builder webhooks can't thread, so we don't use threads.
  Per-ticket grouping uses the prefix + `Cmd+F`.
- **Gate messages** match the format `scripts/ci-notify.sh` would
  post — same canonical event format on both transports (autonomous
  webhook + interactive MCP), though dialect differs (see playbook).
- **Comment on Jira** in parallel, with the same metrics + links
- **Auto-transition tickets**: To Do → In Progress on first CI green,
  In Progress → Done on post-deploy ship

## Deploy safety

- The entire demo is ephemeral — no real customer data, no real
  payments. The `"shipping cost: 0.00"` at checkout is a deliberate
  demo convenience (free shipping over $99).
- `?demo=broken` makes production return 503s. **Always reset with
  `?demo=normal` after a demo.** `scripts/demo-toggle.sh normal` does it.
