# Reference architecture: a mabl-driven agentic development lifecycle

## Thesis

**The author is never the verifier.** A coding agent writes the change and
proposes test changes on a mabl branch. mabl verifies the running application.
Deterministic CI jobs dispatch the runs and read mabl's server-side results; no
model decides pass or fail. A human approves every merge and every mabl-branch
merge.

Run locally by default (0 credits); go to the cloud where mabl's analysis lives:
the PR gate, the post-deploy check, and diagnosing what failed overnight.

## What this mirrors

mabl has written publicly about how its own engineering team ships — a small
fixed smoke gate on every PR, new gates that start advisory and become required,
full regression after merge rather than before it ("How we ship quality at
mabl", "Why our PR gate has 17 tests"). This repo applies the same shape with
mabl's shipped features: test impact analysis, deployment events with test
selection, mabl branches, failure analysis and categorization, agent
instructions, and the mabl skills plugin for coding agents.

Deliberate differences: no GitHub merge queue (personal-account repo; `strict`
branch protection tests the up-to-date head instead), approval is a label
(GitHub doesn't let you approve your own PR), production deploys on merge
rather than by a manual release step, and regression runs nightly against
production.

## Two loops

| | Local developer loop | CI/CD |
|---|---|---|
| Where | Your machine: `npm run dev`, on the Neon `preview` branch (Vercel's Development environment) | GitHub Actions, Vercel, the mabl cloud |
| Starts | Whenever you like | `git push` |
| mabl | Test impact analysis, test edits on the mabl branch, `scripts/mabl-local.sh` (`smoke`, `impact "<change>"`, `run <ids>`) | `mabl-smoke`, `mabl-impact`, post-deploy smoke, nightly |
| Run credits | 0 (AI assertions opt-in with `MABL_LOCAL_AI=1`) | Cloud runs |
| Gives up | Screenshots, mabl's failure analysis, a deployment record | — |

Draft PRs get the static checks only; the mabl cloud gates run when the PR is
marked ready for review.

## Flow

```
Jira ticket
  └─ /ship TAMD-N (Claude Code + mablhq/skills)
       implement → mabl-test-impact → mabl-test-edit on mabl branch = git branch
       → mabl-test-edit-verify → local run (0 credits) → change description
       → human "go" → push + PR
PR (ci.yml)
  lint · unit · build · dependency-review · CodeQL
  preview ─┬─ mabl-smoke   CSH-SMOKE-PR on this PR's preview URL
           └─ mabl-impact  test impact analysis → changed behavior + blast
                           radius, minus smoke tests (cap 10, retry once, each
                           with its plan's login) → PR comment
  Copilot code review   advisory, a different vendor from the coding agent
                        (ruleset "Copilot code review"; every PR and push)
  human-approved (label)
merge → Vercel production
  postdeploy.yml  CSH-SMOKE-POSTDEPLOY on this commit's production build (unique URL),
                  after app-changing merges only
  human merges the mabl branch (after merge-status)
nightly.yml
  full type-rt regression locally vs prod → failures re-run once in the cloud
  → mabl's analysis + category say stale test vs regression
```

## Native vs glue

| Native (mabl, GitHub, Vercel) | Glue in this repo |
|---|---|
| Test impact analysis (`mabl tests impact`) | `scripts/mabl-impact.sh`: description → analysis → cap → dispatch → verdict → comment |
| Deployment events with test selection, URL overrides, retries (`mabl deployments create`) | Waiting for the preview / production URL |
| mabl branches, merge status, fast-forward merge | `scripts/nightly-triage.sh`: local loop → one cloud re-run of failures |
| Failure analysis, categorization, Slack posts | |
| Agent instructions, the skills plugin, the cloud MCP | |
| Dependabot, dependency review, CodeQL, branch protection, Copilot code review | |

## Human checkpoints (and how they're enforced)

| Checkpoint | Enforcement |
|---|---|
| Every PR | `human-approved` required check; agent denied the label in `.claude/settings.json` |
| Waiving the impact gate | `test-impact-gate-exempt` label; agent denied it too |
| mabl branch → master | Human merge; agent denied `mabl branches merge` and the MCP merge tools |
| Push / PR | `/ship` stops for an explicit "go" |

These deny rules are guardrails on the agent, not a security boundary.

## Cost

| Run | Credits |
|---|---|
| Local / CI CLI runs (`/ship`, nightly) | 0 |
| PR: smoke (1 UI + 4 API) | ≈ 1.4 |
| PR: impacted tests (≤ 10 browser) | ≤ 10–15 |
| Nightly cloud re-run | 0 on a green night; ~1–1.5 per failed test |

## Configuration

| Item | Value |
|---|---|
| Workspace / application | `pXXgThbNi4HfQOpiZptHfw-w` / `OZqmshBkUfVSesWy49g1eQ-a` |
| Environments | Preview `TpuarWvfj1hOREDT0JGvjA-e`, Production `vwf8Vni5e7H0XTfT5hbi6w-e` |
| Plans | `CSH-SMOKE-PR` (label `exec-pr`), `CSH-SMOKE-POSTDEPLOY` (`exec-postdeploy`) |
| Regression | label `type-rt`; intentional-failure tests carry `exhibit` and never `type-rt` |
| Databases | Previews use Neon branch `preview`; production uses `main`. mabl's DB connection points at production, so `mabl-impact` skips `seed-db` tests; those with `type-rt` run in the nightly |
| Secrets | `MABL_API_KEY`, `MABL_APPLICATION_ID`, `MABL_ENV_PREVIEW_ID`, `MABL_ENV_PROD_ID` (Actions and Dependabot) |
| When mabl runs | App-changing PRs and merges (`scripts/app-changed.sh`); Dependabot PRs smoke only; docs/CI-only skip |
| Pause switch | repo variable `MABL_CLOUD_GATE=disabled` |
