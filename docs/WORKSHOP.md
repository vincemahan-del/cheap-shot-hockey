# Workshop: a mabl-driven agentic development lifecycle (45 min)

The pipeline is described in [`REFERENCE-ARCHITECTURE.md`](REFERENCE-ARCHITECTURE.md).
Timings below were measured in a full dry run (TAMD-252, the low-stock badge
change).

## Before the session

| When | Do |
|---|---|
| T-60 | `bash scripts/demo-preflight.sh` — fix every ✗. Re-auth `gh`, `mabl auth login --auto`, `vercel login`, the mabl MCP / Claude connector. |
| T-60 | Pick the ticket. A good one changes visible text a test asserts, so test impact finds a test that **fails by design** (the badge change is the reference). Reset it: revert the change on `main` if a previous workshop shipped it. |
| T-45 | Pause Dependabot (no other PRs racing auto-merge). |
| T-30 | `gh variable set MABL_CLOUD_GATE --body enabled`. Open a warm-up PR from the same ticket on a scratch branch so a working preview and a posted impact comment exist as Plan B. |
| T-10 | Close the warm-up PR. Terminal, editor, GitHub PR list, mabl Deployments page and the mabl live view (`/mabl` in Claude Code) open. |

## Flow

| Time | Act | What the audience sees | Measured |
|---|---|---|---|
| 0:00 | Frame (4) | Thesis: the author is never the verifier. One diagram. Local runs cost nothing; the cloud is where mabl's analysis lives. | — |
| 0:04 | Developer loop (12) | `/ship TAMD-N`. Claude implements; `mabl-test-impact` names the test that fails by design, the related tests, and the coverage gaps; `mabl-test-edit` fixes the test on the mabl branch named after the git branch; a version compare shows one changed step; local headless runs pass (0 credits); Claude stops and asks for "go". | analysis ~3–5 min; local runs ~10–40 s each |
| 0:16 | PR gates (10) | Push. `lint`/`unit`/`build`/`dependency-review` in under a minute; `preview` finds this PR's Vercel build; `mabl-smoke` runs `CSH-SMOKE-PR` on that URL; `mabl-impact` runs the analysis against the PR's mabl branch and dispatches only the tests it picks, linked to the analysis; the PR comment appears. Show `human-approved` red until the presenter applies it — and show Claude refusing to apply it. | preview ~1–2 min; smoke ~2–3 min; impact ~5–6 min |
| 0:26 | Ship (8) | Auto-merge. Vercel deploys; `postdeploy.yml` smokes that exact production build. Presenter checks `mabl branches merge-status` and merges the mabl branch in the app. | ~3–4 min |
| 0:34 | Triage (9) | Last night's regression ran locally for free; one failure was re-run in the cloud, where mabl's analysis and category say stale test vs regression. Ask "is this release healthy?" (`check_release_readiness`) from the Claude connector. | — |
| 0:43 | Close (2) | Native vs glue (~250 lines of scripts). What we left out and why. | — |

## Fallbacks

| If | Then |
|---|---|
| Test impact analysis is slow | It caps at ~5 min server-side. Narrate the static gates; show the warm-up PR's comment. |
| `mabl-impact` goes red for an unrelated reason | Apply `test-impact-gate-exempt` and re-run the job. That's the talking point: new gates have false reds, which is why they ship with a waiver. |
| Preview never becomes healthy | Use the warm-up PR. |
| Auto-merge stalls | Check for another merge landing (`strict` protection needs the branch up to date): `gh pr update-branch`. |
| Live view or MCP auth expired | Re-auth; the CLI (`mabl tests impact`, `mabl tests run`) does the same work. |

## Things the dry run taught us

- **Test impact varies run to run.** The same change returned 7 tests on one
  run and 1 on the next. Say so; it's why the gate starts advisory and has a
  waiver.
- **Analyze and run on the mabl branch.** With `--mabl-branch`, a test fixed on
  the branch is judged and run by its new steps; without it, by master's. The
  mabl branch has the git branch's name, slashes included. mabl's by-name branch
  lookup fails on `/`, so CI detects the branch from the open-branch list and
  passes `--auto-branch`, which resolves an existing branch (how mabl's own CI
  runs). The dry run's first passes silently fell back to master until this was
  sorted out.
- **Copy selectors exactly when editing steps.** The step-edit tools reject a
  hand-added field inside a stored selector.
- **`mabl-test-edit-verify` re-runs in the cloud.** When cloud runs are off,
  verify with a version compare plus a local run instead.
- **Visual (AI) assertions don't run locally without `--allow-billable-features`**,
  so local waves skip those tests; CI and the nightly cover them.
- **The cloud-run switch is read when each job starts.** Flipping it mid-PR
  only affects jobs that haven't started yet.
- **Tests outside any enabled plan have no plan login.** `mabl-impact` falls
  back to the demo customer.

## After the session

```bash
gh variable set MABL_CLOUD_GATE --body disabled
```

Resume Dependabot. Delete scratch branches (git and mabl).
