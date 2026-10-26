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
(GitHub doesn't let you approve your own PR), and regression runs nightly
against production.

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
           └─ mabl-impact  test impact analysis → impacted tests (cap 10,
                           retry once, each with its plan's login) → PR comment
  human-approved (label)
merge → Vercel builds a staged production deployment (no traffic)
  postdeploy.yml  CSH-SMOKE-POSTDEPLOY on that build's unique URL
  human merges the mabl branch (after merge-status)
release (human)
  "can we ship?" → check_release_readiness on the staged deployment event
  → vercel promote <staged url>   (same build, no rebuild; vercel rollback to undo)
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
| Dependabot, dependency review, CodeQL, branch protection | |

## Human checkpoints (and how they're enforced)

| Checkpoint | Enforcement |
|---|---|
| Every PR | `human-approved` required check; agent denied the label in `.claude/settings.json` |
| Waiving the impact gate | `test-impact-gate-exempt` label; agent denied it too |
| mabl branch → master | Human merge; agent denied `mabl branches merge` and the MCP merge tools |
| Push / PR | `/ship` stops for an explicit "go" |
| Release to production | Staged production; human runs `vercel promote`; agent denied `vercel promote` |

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
| Secrets | `MABL_API_KEY`, `MABL_APPLICATION_ID`, `MABL_ENV_PREVIEW_ID`, `MABL_ENV_PROD_ID` (Actions and Dependabot) |
| Pause switch | repo variable `MABL_CLOUD_GATE=disabled` |
