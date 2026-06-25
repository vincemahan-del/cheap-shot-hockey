---
last-verified: 2026-06-25
verifies: [".github/workflows/mabl-sdlc.yml", ".github/workflows/codeql.yml", ".github/workflows/blast-radius-gate.yml", ".github/workflows/auto-fix.yml", ".github/workflows/mabl-nightly.yml", "Jenkinsfile", "scripts/llm/check-tool-surface.mjs", "scripts/pipeline-awareness/detect-changes.sh", "scripts/pipeline-awareness/vercel-should-build.sh", "scripts/orchestrator-plan/detect-blast-radius.js", "src/lib/store.ts", "src/lib/orders-db.ts", "vercel.json", "vitest.config.ts", ".mcp.json"]
---

# Reference architecture — agentic SDLC

This is the architectural pattern. The walkthrough is in
[`docs/FORK-GUIDE.md`](FORK-GUIDE.md). The customer demo runbook is in
[`docs/SDLC-DEMO.md`](SDLC-DEMO.md).

## What this is

A reference implementation of an **agentic-by-default software delivery
lifecycle**: one prompt to Claude Code drives a Jira ticket all the way
to production, with mabl gating browser-layer correctness at the right
moments. The pipeline is mostly *workflow* (deterministic, gated, audit-
able) with *agents* only at the edges where the work is genuinely open-
ended (failure diagnosis, test authoring, code review).

This split — workflow for predictable gates, agents for open-ended
problems — is the central design principle. It comes directly from
Anthropic's published guidance on building agents.

## In one screen

```
┌──────────────────────────────────────────────────────────────────────┐
│  Claude Code (interactive)                                           │
│   • CLAUDE.md project conventions                                    │
│   • 3 subagents:  demo-orchestrator · pr-reviewer · mabl-test-author │
│   • MCP servers:  mabl · Jira · Slack · GitHub (gh)                  │
└──────────────────────────────────────────────────────────────────────┘
                               │ creates Jira ticket, branch, PR
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GitHub Actions  (.github/workflows/mabl-sdlc.yml — primary CI)      │
│                                                                      │
│   PR  →  lint · security (npm audit, required) → unit + 90% gate →   │
│        → build                                                       │
│        → T1 newman smoke (Preview, vs Vercel preview deploy)         │
│        → mabl <PREFIX>-SMOKE-PR (Preview, type-smk,exec-pr)          │
│        → test-impact-analysis (advisory PR comment)                  │
│        → claude-code-action DoD                                      │
│                                                                      │
│   Branch protection: 7 required checks · auto-merge armed per PR     │
│                                                                      │
│   main push (after auto-merge) →                                     │
│        → Vercel prod deploy (auto)                                   │
│        → T1 newman smoke (Prod)                                      │
│        → mabl <PREFIX>-SMOKE-POSTDEPLOY (Prod)                       │
│        → on failure: "Prod post-deploy failed" Slack alert           │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Notification fan-out  (scripts/ci-notify.sh at every gate)          │
│   • Slack: demo channel, root-level, [TICKET-XX] prefix              │
│   • Jira: gate-by-gate comment on the ticket                         │
│   • Auto-transition: To Do → In Progress (Stage 1 green)             │
│                      In Progress → Done (post-deploy green)          │
└──────────────────────────────────────────────────────────────────────┘
```

## Component map (factual inventory)

The "what is where" index — every item below is a real file in the repo. The
sections above explain *why*; this is the *where*.

**Application**
- `src/app/**` — Next.js 16 App Router pages + API routes. `src/middleware.ts` mints the session cookie and translates `?demo=` / `?region=` / `?lang=` query params → cookies → request headers (`x-demo-mode`, `x-csh-region`, `x-csh-lang`).
- **Data layer (3-tier hybrid):** products are seeded **in-memory** (`src/lib/seed.ts` via `store.ts`); **orders + users persist to Neon Postgres** (`@neondatabase/serverless`, `orders-db.ts` / `users-db.ts`) when `DATABASE_URL`/`POSTGRES_URL` is set, else an in-memory `Map` — `store.ts` dispatches via `postgresEnabled()`; the **cart** (`cart-cookie.ts`) and **recent-order pointers** (`order-cookie.ts` / `guest-orders.ts`) live in **cookies** so they travel with the request across Vercel's serverless instances.
- `src/lib/region.ts` (currency/tax by region) + `src/lib/locale.ts` (EN/fr-CA language) — two independent axes. `data-testid` on every interactive element for mabl selector stability.

**CI/CD workflows (`.github/workflows/`)**
- `mabl-sdlc.yml` — primary gate. Jobs in order: `change-detector → lint → security → unit → build → t1-smoke-preview → mabl-smoke` (CSH-SMOKE-PR, Preview) → **[merge + Vercel deploy]** → `t1-smoke-prod → post-deploy-smoke` (CSH-SMOKE-POSTDEPLOY, Prod) → `test-impact`.
- `codeql.yml` — CodeQL `security-extended`, PR + push + weekly. **Required** (2026-05-26, TAMD-139).
- `blast-radius-gate.yml` — high-blast-radius human checkpoint (holds auto-merge until the `blast-radius-approved` label).
- `claude-agentic-dod.yml` — agentic definition-of-done (advisory, analysis-only, SHA-pinned action, pinned model, same-repo only).
- `auto-fix.yml` — deterministic `eslint --fix` + circuit breaker.
- `mabl-nightly.yml` — full `type-rt` drift vs prod (needs `MABL_API_KEY`; currently unset → runs but skips).
- `security-audit-cron.yml` — scheduled `npm audit`.
- `Jenkinsfile` (repo root, **not** a GHA workflow) — parallel/legacy 9-stage pipeline on a local Jenkins: checkout → install → detect-changes → lint → unit+coverage → build → preview → mabl CSH-SMOKE-PR → promote → mabl CSH-SMOKE-POSTDEPLOY. Older than the GHA workflow and does **not** mirror its security gate or cycle-time receipt; **the GHA `mabl-sdlc.yml` is canonical.** Jenkins doesn't deploy — Vercel does; it only triggers mabl to gate.

**Deterministic control planes (`scripts/`)**
- `pipeline-awareness/detect-changes.sh` — emits `has_app/lib/api/deps/workflows` path flags consumed by the SDLC jobs and the Vercel gate.
- `pipeline-awareness/vercel-should-build.sh` — Vercel ignore-build gate; **fail-open** (TAMD-174) — builds when it can't resolve the parent commit, rather than silently skipping.
- `orchestrator-plan/detect-blast-radius.js` — blast-radius classifier (risky paths / >200 LOC / removed exports / >5 files / new deps).
- `llm/check-tool-surface.mjs` — static contract locking the agent tool surface; runs in the lint gate.

**mabl (`scripts/` + MCP)**
- `mabl-deployment.sh` (trigger plan runs) · `mabl-suggest-tests.sh` (test-impact) · `mabl-local-cli.sh` / `mabl-local-gate.sh` (local CLI gate, the compensating control when the cloud gate is paused) · `mabl-analyze-last-failure.sh` (triage).
- MCP: `.mcp.json` pins the local (deprecated) mabl server; the cloud server (`mcp.mabl.com`) is the going-forward one, auth via OAuth **or** headless `x-api-key`. Authored coverage loop: `plan_new_test → create_mabl_test_cloud → label = Jira key (cloud edit_mabl_test) → run → analyze_failure → refine`.
- Plan-label intersections: `type-smk,exec-pr` (CSH-SMOKE-PR) · `type-smk,exec-postdeploy` (CSH-SMOKE-POSTDEPLOY) · `type-rt` (nightly).

**Agentic surface (`.claude/agents/`)**
- `demo-orchestrator` · `pr-reviewer` · `mabl-test-author`. Definition of Done lives in `AGENTS.md` + `CLAUDE.md`: coverage ≥90% on `src/lib/**`, mabl test-impact, and new UI/API → author a mabl test + **label it with the Jira key** (TAMD-176).

**Observability (`scripts/`)**
- `ci-notify.sh` (canonical Slack event format) · `cycle-time-receipt.sh` (lead time, GHA minutes, CI attempts, human touches) · Jira lifecycle auto-transitions.

**Config & repo controls**
- `vercel.json` (`ignoreCommand`) · `vitest.config.ts` (coverage ≥90% on `src/lib`) · `next.config.ts` (next-intl plugin) · `.github/dependabot.yml`.
- `MABL_CLOUD_GATE` (repo variable) toggles the PR/post-deploy mabl cloud runs for cost control · `MABL_API_KEY` (secret) unlocks the nightly CLI job — **currently unset**.

## The four-phase pipeline

This pattern mirrors [mabl's published architecture](https://www.mabl.com/blog/how-we-built-a-system-for-ai-agents-to-ship-real-code-across-75-repos) for shipping AI-assisted code across 75+ repos.

| Phase | What happens | Surface | Human gate? |
| --- | --- | --- | --- |
| **1. Analysis** | Read ticket, scan `CLAUDE.md`, identify affected files, surface open questions | Interactive Claude Code (orchestrator subagent) | No — agent autonomous |
| **2. Planning** | Detect blast radius (path-based + LOC); for high-risk changes, emit a structured plan to Jira and pause | Interactive Claude Code + `scripts/orchestrator-plan/` | **Yes for high-blast-radius changes** |
| **3. Implementation** | Code changes, pre-PR DoD (coverage gate, mabl impact analysis), commit, push, PR opened, auto-merge armed | Interactive Claude Code → GHA pipeline | No — gated by CI |
| **4. Review** | 7 required CI checks (lint, security, unit, build, T1 newman, mabl smoke, CodeQL), AI code review, **mandatory human approval at merge**. See [`docs/MERGE-POLICY.md`](MERGE-POLICY.md). | GHA pipeline + branch protection + reviewer policy | **Yes at merge** |

## Regression coverage — PR-time smoke + nightly drift

The `mabl — CSH-SMOKE-PR (Preview)` job covers browser-layer smoke on every PR with app changes. The nightly workflow (`.github/workflows/mabl-nightly.yml`) runs the full `type-rt` suite headlessly against production via mabl CLI — free, single-browser, results published to mabl app via `--reporter mabl`. The combination catches PR-time UI regressions and over-time drift without a per-PR cloud regression dispatch.

An earlier area-targeted tier-4 matrix (`mabl-cli-pr-regression` + `mabl-cloud-regression-high-blast` + `regression-rollup`) was removed in `chore/collapse-tier4-matrix` — the matrix infrastructure exceeded the value of the three-bucket routing it provided on a single-application demo repo.

## Pipeline path-awareness — skip gates when changes don't warrant them

A `change-detector` job at the top of `mabl-sdlc.yml` runs `scripts/pipeline-awareness/detect-changes.sh` once and emits boolean flags about what kind of files the PR touched: `has_app_changes`, `has_lib_changes`, `has_api_changes`, `has_deps_changes`, `has_workflows_changes`. Every expensive downstream job gates on the appropriate flag and **skips** when its change category isn't relevant. Skipped jobs report **success** to branch protection — the seven-gate contract from `docs/MERGE-POLICY.md` remains intact.

Concrete effect on a docs-only PR: `security`, `unit`, `build`, `t1-smoke-preview`, `mabl-smoke` all skip. Only `lint` and `regression-rollup` actually run. Saves ~3 min CI runner + mabl cloud minutes per docs PR.

Layer 2 — Vercel side: `scripts/pipeline-awareness/vercel-should-build.sh` is set as Vercel's "Ignored Build Step" in project settings. Vercel calls it before every potential build; the script invokes `detect-changes.sh` and exits 0 (skip) only when it has a *positive* "no app paths changed" result. It **fails open** (TAMD-174): on Vercel's shallow clone where `HEAD~1` is absent, it tries `git fetch --deepen=1` and otherwise builds rather than silently skipping a real deploy — the prior fail-closed behavior stranded prod on the previous commit and forced manual re-trigger commits.

Spec: TAMD-132. Conservative path patterns deliberately err toward "run when uncertain" — false positives cost minutes, false negatives cost reliability.

## Plan-mode signal sources

Plan-mode (Phase 2) combines three signal sources:

- **Path-based** — matches `src/lib/auth/**`, `src/app/api/openapi/**`, `.github/workflows/**`, agent system prompts, shared data layer
- **LOC threshold** — > 200 lines added+removed
- **Breaking-change signals** (deterministic from diff parsing) — removed exports in TS/TSX, scope > 5 files, new `package.json` dependencies

Combined detection mirrors mabl's published confidence-signal pattern — all signals are deterministic from the diff alone, no agent self-report required.

## Where workflows end and agents begin

| Surface | Type | Why this type |
| --- | --- | --- |
| Lint, unit tests, coverage gate, build, newman smoke | Workflow | Deterministic, predictable, auditable. No reason to use an agent. |
| mabl plan execution | Workflow (with AI inside the tests) | The trigger is workflow; the smart-locator healing inside mabl is agentic — but at the test-execution layer, not the gate layer. |
| Branch protection + auto-merge | Workflow | Pure rule evaluation. |
| Jira lifecycle transitions (To Do → In Progress → Done) | Workflow | Triggered by gate transitions; rule-based. |
| Slack/Jira gate notifications | Workflow | Templated messages, deterministic composition. |
| Post-deploy failure response | Workflow | Deterministic Slack/Jira alert. Human triages from there. v1 has no autonomous LLM-driven diagnosis. |
| **Test authoring** (mabl-test-author subagent) | **Agent** | Plain-English description of a flow → test plan with assertions. Open-ended. |
| **Convention review** (pr-reviewer subagent) | **Agent** | "Does this match the codebase's conventions?" requires context that's hard to express as rules. |
| **Ticket-to-prod orchestration** (demo-orchestrator subagent) | **Agent** | The work the human prompt describes is open-ended — ticket creation, branch naming, code change, PR body, Slack kickoff format. |

## Anthropic best practices encoded here

The pattern follows these published Anthropic principles:

1. **Start with the simplest workflow; only add agents where measurably needed.** Most of the pipeline is workflow because workflow is enough. Agents appear at two points: orchestration (interactive Claude Code laptop session) and the in-CI `@claude` / DoD actions (read-only by default; `/claude write` escalation gated to OWNER/MEMBER).

2. **Tool design matters as much as model choice.** The `@claude` action's tool surface is enforced at the action's `--allowed-tools` flag, not at the prompt level. The static contract check (see principle 8) blocks any PR that widens the surface. Customers asking "wait, AI just merges to prod?" get a concrete answer: *no, every Claude-driven job has a paren-restricted Bash allowlist and explicit author gating.*

3. **Sandbox by tool restriction, not just by prompt.** `READ_ONLY_TOOLS` / `WRITE_MODE_TOOLS` / `DOD_ANALYSIS_TOOLS` lists in the workflow YAML are the source of truth; `scripts/llm/check-tool-surface.mjs` asserts they stay narrow on every PR.

4. **File-based memory + CLAUDE.md project conventions.** The orchestrator subagent reads `CLAUDE.md` for project conventions on every invocation — single source of truth that stays in git.

5. **Subagents with separate context windows for context isolation.** Three subagents handle distinct flows; each gets its own context window so a long orchestration session doesn't poison the test-authoring subagent's reasoning.

6. **MCP for tool exposure.** Slack, Jira, mabl, and GitHub are exposed as MCP servers — customers can swap in their own MCP servers without changing the agent code.

7. **Lock the agentic surface, then statically enforce it.** Two Claude-driven jobs run on this repo (`@claude`, agentic DoD). Both have narrow tool surfaces, pinned models, pinned action SHAs, and (for the public-repo `@claude`) an `author_association` allowlist that silently no-ops drive-by comments. `scripts/llm/check-tool-surface.mjs` runs in the lint gate on every PR and fails the merge if anyone widens the surface — so the hardening is enforced by branch protection, not by reviewer attention. Full details in [`AGENTS.md`](../AGENTS.md#agentic-surface--hardened-gates).

## What's autonomous vs what needs a human

Honest split. Customers will press on this.

| Surface | Autonomous? | Needs a human? |
| --- | --- | --- |
| GHA workflow + branch protection + auto-merge | Yes | No |
| Slack + Jira posts at every gate | Yes (via webhook + bot token) | No |
| Jira lifecycle transitions | Yes | No |
| Vercel (or equivalent) deploy on main push | Yes | No |
| Post-deploy failure alert (deterministic Slack/Jira) | Yes | No |
| **Initial prompt that starts the orchestrator** | **No** | **Yes** |
| **Triaging a post-deploy failure** (investigate, revert, forward-fix) | **No** — v1 has no autonomous diagnosis | **Yes** |
| Test authoring | Yes (when invoked from interactive Claude Code) | The invocation needs a human |
| Convention review (pr-reviewer subagent) | Yes (when invoked) | The invocation needs a human |

The **interactive Claude Code subagents** need a human prompt to start
them, but everything they kick off is autonomous past that point. For
true headless ticket-to-prod (Jira webhook → orchestrator runs without
a human), the subagent system prompts port to **Agent SDK `query()`**
calls invoked from a webhook handler. That's a separate piece of work.

## Failure modes the architecture is designed for

- **A code regression catches in PR-gate mabl** → the merge button stays
  red, ci-notify posts `:rotating_light:` with mabl's screenshot link.
  Auto-merge stays armed; merge fires when CI re-greens.
- **A code regression escapes to post-deploy** → deterministic "Prod post-deploy failed" Slack alert with links to the failing run + mabl plan. Human triages from there. Prod stays broken until the human acts — by design, because autonomous prod mutations are out of scope for v1.
- **mabl flake or `?demo=broken` toggle** → same path: post-deploy alert, human reads the mabl detail, flips the toggle back or retries. No LLM-driven diagnosis layer in v1.

## Auto-fix workflow (deterministic v1)

On a PR with a fixable lint failure, `.github/workflows/auto-fix.yml` runs `eslint --fix`, verifies the issue is resolved, and commits the result back to the PR branch — which re-triggers the main CI workflow on the cleaned commit.

**Circuit breaker:** the workflow counts consecutive commits authored by `github-actions[bot]` with `auto-fix` in the subject. After 2, it stops and posts to Slack — preventing fix-fail loops.

**Sandbox:** only the PR's head branch (never main), only `eslint --fix` (single command), skips Dependabot + cross-repo forks. v1 is deterministic — no LLM, no API key required, customer-deployable as-is.

v2 (TAMD-113) layers an Agent SDK loop on top for non-formatter fixes (type-annotation typos, missing imports beyond eslint's scope) — same circuit-breaker pattern, plus narrow `allowedTools` enforcement at the SDK boundary.

Mirrors [mabl's published auto-fix-agent pattern](https://www.mabl.com/blog/how-we-built-a-system-for-ai-agents-to-ship-real-code-across-75-repos) with circuit breakers.

## Cycle-time receipt (per ticket)

Every shipped ticket gets a final `:receipt:` Slack message at the end of the post-deploy chain. v1 metrics, all deterministic from native GitHub + mabl APIs:

- **Lead time** — PR open → merged.
- **GHA minutes** — total across all workflow runs for this ticket.
- **CI attempts** — count of `pull_request` workflow runs on the PR head, split by failure vs success.
- **Human touches** — review count + approver handles + manual reruns (counts both `workflow_dispatch` events AND UI-driven `run_attempt > 1` re-runs).

`scripts/cycle-time-receipt.sh` is the implementation. Customer ROI story: *"how fast did this ship, and how much friction was in the cycle?"* Per-ticket numbers in the channel, trend tracking via Slack search.

## Cost-control: the `MABL_CLOUD_GATE` toggle

mabl cloud runs cost money per PR + per main push. Customers will have different cost profiles, especially during dev iteration or feature build-out where per-PR browser verification isn't worth the bill.

The architecture exposes a single repo variable, `MABL_CLOUD_GATE`:

| Value | Behavior |
| --- | --- |
| `enabled` (or missing) | Default. mabl cloud runs fire on every PR + main push. |
| `disabled` | mabl jobs skip the cloud trigger and exit success. ci-notify posts a clear "paused" message. T1 newman API smoke (local CLI) remains the always-on review surface. |

```bash
# pause cloud runs (cost-control mode)
gh variable set MABL_CLOUD_GATE --body "disabled" --repo OWNER/REPO

# reenable
gh variable set MABL_CLOUD_GATE --body "enabled" --repo OWNER/REPO
```

The toggle is a **repo variable** (not a secret) so it surfaces in run logs and is auditable. No code changes required to flip it. Customers fork and inherit this toggle as part of the reference architecture; it's not specific to this demo.

## What's NOT in v1

The reference architecture deliberately leaves these out for v1 to
keep the surface understandable. Each is a known follow-up:

- **Pluggable notification transports** (Teams, just-Jira, just-GitHub)
  — Slack-only in v1.
- **Autonomous post-deploy recovery agent** — v1 deliberately fires a
  deterministic Slack alert and stops; humans triage. An earlier
  Agent SDK implementation is preserved at git tag
  `archive/recovery-agent-and-receipts-v1` and can be reinstated by
  any fork that has an `ANTHROPIC_API_KEY` available.
- **Plan mode "AI proposes, human disposes"** — for high-blast-radius
  changes (auth, payments, schema migrations) the orchestrator should
  post a plan to Jira and wait for approval before executing.
- **Per-ticket LLM cost aggregation** — the cycle-time receipt covers
  lead time + GHA + mabl + friction, but not aggregated LLM cost.
  Preserved at the same archive tag if you want to wire it.
- **Eval harness** for the orchestrator — Anthropic's "don't ship
  agents you can't measure" advice.
- **Feature-flag wrap by default** — orchestrator wraps net-new UI
  behind a flag, ships at 0%, ramps via follow-up PR.
- **Sigstore / SBOM** — supply-chain attestation; mention only.

These are sequenced in `docs/SDLC-DEMO.md` "Optional enhancements" and
described in conversation history (M5-M8 from the customer-deployable
plan).

## Reading order for a new fork

1. [`docs/REFERENCE-ARCHITECTURE.md`](REFERENCE-ARCHITECTURE.md) (this doc) — what the pattern is and why
2. [`docs/FORK-GUIDE.md`](FORK-GUIDE.md) — how to deploy it on your stack
3. [`docs/SDLC-DEMO.md`](SDLC-DEMO.md) — how to demo it once you have it running
4. [`docs/MCP-NARRATION-PLAYBOOK.md`](MCP-NARRATION-PLAYBOOK.md) — the canonical event format for Slack/Jira posts
5. `CLAUDE.md` (root) — project conventions the agents read
6. `.claude/agents/*.md` — the three Claude Code subagent system prompts
