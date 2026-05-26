---
last-verified: 2026-05-26
verifies: [".github/workflows/mabl-sdlc.yml", ".github/workflows/blast-radius-gate.yml", "vitest.config.ts"]
---

# Merge policy — required vs advisory checks

Branch protection on `main` enforces a small set of **required** checks.
Everything else that runs on a PR is **advisory** — it posts signal
(comments, annotations, observations) but does not block merge.

This split is deliberate. Required checks are the ones we are willing
to roll back a merge over. Advisory checks are agentic analysis whose
job is to *surface* things for a human, not to gate.

## Required checks (block merge)

These are configured on
`https://github.com/vincemahan-del/cheap-shot-hockey/settings/branches`
and verified via `gh api repos/.../branches/main/protection`.

| Check | Workflow | Why it blocks |
|---|---|---|
| `lint (eslint)` | `mabl-sdlc.yml` | Style + correctness; cheap to fix, cheap to fail |
| `security (npm audit)` | `mabl-sdlc.yml` | High/critical CVE in dependency tree blocks merge |
| `unit tests + coverage` | `mabl-sdlc.yml` | Vitest gate at 90% on lines, statements, functions, and branches (see [`vitest.config.ts:26-31`](../vitest.config.ts)); fails fast on regression |
| `build (next)` | `mabl-sdlc.yml` | Type-check + bundle; broken build = broken deploy |
| `T1 — newman smoke (Preview)` | `mabl-sdlc.yml` | Postman API journeys against the Vercel Preview deploy |
| `mabl — CSH-SMOKE-PR (Preview)` | `mabl-sdlc.yml` | Browser-layer smoke against Preview; the UI gate |
| `CodeQL` | `codeql.yml` | Static security analysis; a high-severity code-scanning alert blocks merge. Promoted from advisory 2026-05-26 (TAMD-139) after a ReDoS shipped to prod under the advisory regime (TAMD-138). |
| `blast-radius` | `blast-radius-gate.yml` | Holds auto-merge on high-blast-radius diffs (auth, API contract, CI infra, agent prompts, shared data layer, >200 LOC, removed exports, new deps) until a maintainer applies the `blast-radius-approved` label. Passes automatically on low-risk diffs. |

Seven gates today; eight required contexts once branch protection is
updated to include `blast-radius`. That branch-protection update is a
separate, deliberate step (repo admin), tracked in TAMD-143 and applied
after this PR merges — until then `blast-radius` runs and reports status
but does not yet block. If any required check fails, auto-merge does not
fire. Period.

### Conditional execution (TAMD-132)

A `change-detector` job at the top of `mabl-sdlc.yml` emits boolean
flags about what changed. Several required checks gate on those flags
and **skip** when the change doesn't warrant them. Skipped jobs report
**success** to branch protection — the contract above is intact.

| Check | Runs when |
|---|---|
| `lint (eslint)` | Always (cheap, catches workflow YAML errors via plugins) |
| `security (npm audit)` | `package*.json` changed |
| `unit tests + coverage` | `src/lib/**` or `vitest.config.ts` changed |
| `build (next)` | `src/**`, `public/**`, or build config changed |
| `T1 — newman smoke (Preview)` | `src/app/api/**`, `src/lib/**`, or `mabl/postman/**` changed |
| `mabl — CSH-SMOKE-PR (Preview)` | `src/**`, `public/**`, or build config changed |
| `CodeQL` | Always (every PR + push to main); the security baseline |
| `blast-radius` | Always (every PR) |

`workflow_dispatch` (manual trigger) forces every flag to `true` so a
full pipeline run is always achievable on demand.

This pattern saves mabl cloud minutes + Vercel build minutes + GHA
runner time on docs-only / workflow-only / config-only PRs without
weakening any gate that has signal to provide.

### Blast-radius auto-merge gate (TAMD-143)

`blast-radius-gate.yml` is the CI enforcement of the high-blast-radius
human checkpoint that previously lived **only** inside the orchestrator
subagent prompt (`.claude/agents/demo-orchestrator`,
`docs/MCP-NARRATION-PLAYBOOK.md`). It reuses the existing deterministic
detector at `scripts/orchestrator-plan/detect-blast-radius.js` as-is —
no LLM call, no new dependencies.

On every PR the gate runs the detector against the PR base SHA:

- **Low blast radius** → the gate passes immediately. Low-risk PRs are
  unaffected.
- **High blast radius + `blast-radius-approved` label present** → the
  gate passes. A maintainer has reviewed the diff and signed off.
- **High blast radius + label absent** → the gate is **red** (exit 1),
  which holds auto-merge. It posts a sticky PR comment listing the
  detector's reasons and one Slack line via `scripts/ci-notify.sh`.

The label mechanism is what flips the gate green. The workflow's
`pull_request` trigger includes the `labeled`/`unlabeled` event types,
so applying the `blast-radius-approved` label **re-runs the gate
automatically** — it goes red→green with no manual re-run. Removing the
label re-arms the hold.

A diff is "high blast radius" when the detector flags any of: a
high-risk path (auth, API contract, CI infra, agent prompts, shared
data layer), > 200 LOC added+removed, a removed TS/TSX export, > 5
files touched, or a new `package.json` dependency.

**Promotion to required is a separate step.** This PR adds the
workflow; it does not modify branch protection or create the
`blast-radius-approved` GitHub label. Both are deliberate, repo-wide
admin actions tracked in TAMD-143 and applied after merge. Until branch
protection is updated, `blast-radius` runs and reports status but does
not yet block — at which point the required-context count goes from
seven to eight.

## Advisory checks (post signal, do not block)

| Check | Workflow | Role |
|---|---|---|
| `Claude — definition of done` | `claude-agentic-dod.yml` | LLM reviews diff, coverage, mabl gaps; posts a single PR comment |
| `auto-fix (eslint --fix)` | `auto-fix.yml` | Deterministic auto-formatting commit on PR branches |
| `test impact analysis` | `mabl-sdlc.yml` | Heuristic mapping of changed files → affected mabl tests |
| `T1 — newman smoke (Prod)` | `mabl-sdlc.yml` | Skipped on PR; runs post-merge against Production |
| `mabl — CSH-SMOKE-POSTDEPLOY (Prod)` | `mabl-sdlc.yml` | Skipped on PR; runs post-merge against Production |
| `Vercel`, `Vercel Preview Comments` | Vercel app | Deploy status; not a quality gate |

## Why advisory matters

The agentic DoD check (`claude-agentic-dod.yml`) is intentionally
analysis-only — its tool surface is `Read,Glob,Grep` plus scoped Bash
and read-only mabl/atlassian MCPs. It has **no** `Edit`, `Write`, or
`*create*` tools. Its job is to *list gaps* in a PR comment so a human
can decide what to do.

Making it block would invert the contract: an LLM that cannot fix
anything would become the thing that prevents merge. That's a bad
trade. If the LLM is wrong (bad API key, rate limit, hallucinated
finding) the team is stuck waiting on a meaningless gate.

The required-vs-advisory split keeps the gating story simple to
defend: **seven deterministic gates block merge, agentic checks
inform**.

## When advisory checks fail

A failed advisory check is not a merge blocker, but it should still be
triaged:

- `Claude — definition of done` fails on `Invalid API key` → secrets
  rotation issue, not code quality. File a `tooling` issue, fix the
  secret, re-run. Do not block PR throughput on it.
- Area regression dispatch flags a new failure → the run is post-merge
  signal. Open a Jira ticket; if a P1, revert the merge.

Note: `CodeQL` moved from advisory to **required** on 2026-05-26
(TAMD-139). A high-severity code-scanning alert now blocks merge — see
the required-checks table above. A finding the team accepts (e.g. a
demo-only weak hash) is dismissed with a documented justification in the
Security tab rather than left to block indefinitely.

## Adding or removing a required check

Required checks live in branch protection — editing them requires repo
admin and should be deliberate. Process:

1. Open a PR that updates this doc and includes the new/removed check
   name in the table.
2. In the PR description, state *why* the change is justified — what
   class of failure it would have caught (for adding) or what class of
   noise it has produced (for removing).
3. After merge, update branch protection via `gh api` or the UI to
   match the doc.
4. Verify with `gh api repos/vincemahan-del/cheap-shot-hockey/branches/main/protection`.

The doc is the source of truth for the *policy*; branch protection is
the source of truth for the *enforcement*. They should match. If they
drift, the policy doc wins and branch protection should be updated.
