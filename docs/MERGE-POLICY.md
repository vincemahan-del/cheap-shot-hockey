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
| `unit tests + coverage` | `mabl-sdlc.yml` | Vitest gate at 90% functions; fails fast on regression |
| `build (next)` | `mabl-sdlc.yml` | Type-check + bundle; broken build = broken deploy |
| `T1 — newman smoke (Preview)` | `mabl-sdlc.yml` | Postman API journeys against the Vercel Preview deploy |
| `mabl — CSH-SMOKE-PR (Preview)` | `mabl-sdlc.yml` | Browser-layer smoke against Preview; the UI gate |

Five gates. If any of them fails, auto-merge does not fire. Period.

## Advisory checks (post signal, do not block)

| Check | Workflow | Role |
|---|---|---|
| `Claude — definition of done` | `claude-agentic-dod.yml` | LLM reviews diff, coverage, mabl gaps; posts a single PR comment |
| `auto-fix (eslint --fix)` | `auto-fix.yml` | Deterministic auto-formatting commit on PR branches |
| `CodeQL` (`Analyze (javascript-typescript)`) | `codeql.yml` | Security analysis; results posted to the Security tab |
| `mabl cloud regression — high-blast (area=*)` | `mabl-sdlc.yml` | Area-targeted regression dispatch; post-merge signal |
| `mabl CLI regression (area=*)` | `mabl-sdlc.yml` | API-layer regression dispatch |
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
defend: **five deterministic gates block merge, agentic checks
inform**.

## When advisory checks fail

A failed advisory check is not a merge blocker, but it should still be
triaged:

- `Claude — definition of done` fails on `Invalid API key` → secrets
  rotation issue, not code quality. File a `tooling` issue, fix the
  secret, re-run. Do not block PR throughput on it.
- `CodeQL` flags a vulnerability → results appear in the
  [Security tab](https://github.com/vincemahan-del/cheap-shot-hockey/security/code-scanning).
  Open a follow-up PR; do not gate the current PR on it unless the
  finding is in the diff.
- Area regression dispatch flags a new failure → the run is post-merge
  signal. Open a Jira ticket; if a P1, revert the merge.

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
