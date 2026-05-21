# Cheap Shot Hockey — mabl agentic-SDLC demo runbook

A stage-by-stage script for demoing mabl's value across an **agentic-by-default**
software delivery lifecycle. The headline isn't "we have a CI pipeline" —
it's that one prompt in Claude Code drives a Jira ticket all the way to
production, with mabl gating at the right moments.

Expected runtime: **20–30 minutes** for a full walkthrough. Each act is
self-contained, so you can shorten to any subset.

A real recent run for cycle-time reference: **TAMD-99** (size-guide page
restore) shipped from PR-open to live + verified in **~8 minutes**, fully
autonomous past the initial prompt.

---

## Architecture in one screen

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
│   PR  →  lint → unit + 90% coverage gate → build                     │
│        → T1 newman smoke (Preview, vs Vercel preview deploy)         │
│        → mabl CSH-SMOKE-PR (Preview, labels: type-smk,exec-pr)       │
│        → test-impact-analysis (advisory PR comment)                  │
│        → claude-code-action DoD                                      │
│                                                                      │
│   Branch protection: 7 required checks · auto-merge armed per PR     │
│                                                                      │
│   main push (after auto-merge) →                                     │
│        → Vercel prod deploy (auto)                                   │
│        → T1 newman smoke (Prod)                                      │
│        → mabl CSH-SMOKE-POSTDEPLOY (Prod, labels: type-smk,exec-postdeploy)│
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Notification fan-out  (scripts/ci-notify.sh at every gate)          │
│   • Slack: #vince-agentic-workflow-demos, channel root,              │
│     prefixed [TAMD-XX] for Cmd+F audit trail                         │
│   • Jira: gate-by-gate comment on the ticket                         │
│   • Auto-transition: To Do → In Progress (Stage 1 green)             │
│                      In Progress → Done (post-deploy green)          │
└──────────────────────────────────────────────────────────────────────┘
```

Jenkins (`Jenkinsfile`) runs in parallel and mirrors the same gate
sequence. It's optional; the canonical CI is GHA.

## Narration surfaces

The demo runs across visible screens. Tab-switching as each gate fires
*is* the narration.

| Screen | URL / app | What the customer sees |
| --- | --- | --- |
| **VS Code** | Claude Code terminal | Agent reasoning, MCP calls, Jira/Slack posts firing live |
| **Slack** | `#vince-agentic-workflow-demos` | Gate-by-gate messages with metrics, links, mabl screenshots |
| **GitHub PR** | `github.com/<repo>/pull/<N>` | DoD comment, status checks updating in real time, auto-merge label |
| **Jira** | `mabl.atlassian.net/browse/TAMD-XX` | Comments auto-posting, ticket transitioning To Do → In Progress → Done |
| **mabl** | `app.mabl.com` → plan run | Tests running live, smart locator healing, failure screenshots |

Opening line for the customer:
> "The engineer types one prompt in Claude Code. Watch what happens
> across every system, with no further input."

Then don't talk — let the agent run. Tab-switch as each gate fires.

---

## Before the demo

### Provision mabl

1. **Workspace:** create or pick one. Capture the workspace UUID.
2. **Application:** add "Cheap Shot Hockey". Capture the application UUID.
3. **Environments:** create two — **Preview** and **Production**. Point
   them at `https://cheap-shot-hockey-git-<branch>.vercel.app` and
   `https://cheap-shot-hockey.vercel.app` respectively. Capture the UUIDs.
4. **Credentials:** add `demo@cheapshot.test` / `demo1234` for both envs.
5. **API token:** Settings → APIs → create a fresh token. Copy it.
6. **Plans (split by environment — non-negotiable):**
   - **`CSH-SMOKE-PR`** — Preview env only. Labels: `type-smk,exec-pr`.
     Gates the merge button on every PR.
   - **`CSH-SMOKE-POSTDEPLOY`** — Prod env only. Labels: `type-smk,exec-postdeploy`.
     Verifies the live site after Vercel deploys.

   Don't unify them — the env split is what lets the same notifier code
   run cleanly on both PR and main pushes.

### Provision GHA (primary CI)

Workflows in `.github/workflows/`:

- **`mabl-sdlc.yml`** — the canonical gate sequence (lint → unit + 90% coverage → build → T1 newman Preview → mabl CSH-SMOKE-PR → on main push, T1 newman Prod → mabl CSH-SMOKE-POSTDEPLOY → deterministic Slack alert on post-deploy failure). Also runs an advisory `security` job (`npm audit --audit-level=high`) in parallel with `lint`.
- **`codeql.yml`** — GitHub-native static analysis on every PR + push to main + a weekly Monday cron, with results in the Security tab. Uses the `security-extended` query suite.
- **Dependabot** (`.github/dependabot.yml`) — weekly dep-update PRs for npm and `github-actions`. Each PR runs the full SDLC pipeline.

Set these as repo secrets:

| Secret | Source |
| --- | --- |
| `MABL_API_TOKEN` | mabl Settings → APIs |
| `MABL_WORKSPACE_ID` · `MABL_APPLICATION_ID` · `MABL_ENV_PREVIEW_ID` · `MABL_ENV_PROD_ID` | from steps above |
| `SLACK_WEBHOOK_URL` | Slack Workflow Builder webhook (no admin needed) — autonomous notifications |
| `JIRA_USER_EMAIL` · `JIRA_API_TOKEN` | Atlassian account → Security → API tokens |

Branch protection on `main`: require these 7 checks before merge:

- `lint (eslint)`
- `security (npm audit)`
- `unit tests + coverage`
- `build (next)`
- `T1 — newman smoke (Preview)`
- `mabl — CSH-SMOKE-PR (Preview)`
- `regression rollup`

See [`docs/MERGE-POLICY.md`](MERGE-POLICY.md) for the rationale per gate
and the advisory-vs-required split.

Repo settings: enable "Allow auto-merge" + "Automatically delete head branches".

### Provision Jenkins (optional, parallel)

```bash
docker compose -f docker-compose.jenkins.yml up -d
open http://localhost:8080
# follow unlock instructions, install recommended plugins
# add "mabl-api-token" credential (String, scope: global)
# New Item → Pipeline → "Pipeline script from SCM" → this repo URL
```

Set the same `MABL_*` and `PRODUCTION_URL` env vars under
**Manage Jenkins → System**. The Jenkinsfile mirrors the GHA pipeline
stage-for-stage.

### Pre-flight (before screen-share)

1. `?demo=normal` — make sure prod isn't stuck in slow/flaky/broken from
   a previous demo: `./scripts/demo-toggle.sh normal`
2. Slack channel open and pinned in your tab bar
3. mabl workspace open in another tab
4. Jira project filtered to TAMD, ordered by Updated
5. Claude Code in this repo with the 3 subagents available
   (`.claude/agents/demo-orchestrator.md` etc.)

---

## Act 1 — Shift-left authoring (3 min)

**Story:** "An engineer is adding a feature and wants to lock in test
coverage before they even push code."

1. Open Claude Code in this repo.
2. Prompt: *"I'm adding a wishlist feature at `/wishlist`. Use the
   mabl-test-author subagent to draft a UI test that logs in, adds a
   product to the wishlist, and verifies it persists after refresh."*
3. Claude delegates to the `mabl-test-author` subagent — it calls
   `mabl plan_new_test` → `create_mabl_test_cloud` →
   `get_cloud_test_gen_status` and tier-tags the test per
   `docs/MABL-AI-ASSERTION-PROMPT.md` (structural assertions only — no
   marketing-copy assertions).
4. Tab-switch to mabl — the new test is there, already wired to Preview.

**mabl value shown:** AI-native authoring, MCP integration, shift-left
QA investment, tier-tagged assertion policy.

---

## Act 2 — Agentic ticket-to-prod (8–10 min)

**Story:** "One prompt. The agent runs through four phases — Analysis, Planning, Implementation, Review — and ships to prod, with humans gating only the consequential decisions."

This act mirrors the four-phase pattern mabl uses internally to ship code across 75+ repos (see [mabl's published architecture](https://www.mabl.com/blog/how-we-built-a-system-for-ai-agents-to-ship-real-code-across-75-repos)). Same shape, packaged for customer adoption.

| Phase | What happens | Human gate? |
| --- | --- | --- |
| **1. Analysis** | Orchestrator reads the ticket, scans `CLAUDE.md`, identifies affected files | No — agent autonomous |
| **2. Planning** | If the change is **high-blast-radius** (auth, API contract, > 200 LOC, etc.), orchestrator emits a plan to Jira and pauses | **Yes for high-blast** — human approves before code is written |
| **3. Implementation** | Code changes, pre-PR DoD (coverage gate, mabl impact), commit, push, PR opened, auto-merge armed | No — gated by CI |
| **4. Review** | 7 required CI checks (lint, security, unit, build, T1 newman, mabl smoke, regression rollup), AI code review (`pr-reviewer`), human approval at merge | **Yes at merge** — required reviewer policy |

### Demo flow

1. In Claude Code, prompt: *"Use demo-orchestrator to ship a small
   change: add a 'Free shipping over $99' badge to the cart page."*
2. The orchestrator subagent runs Phase 1 (Analysis):
   - Creates a Jira ticket in TAMD (e.g. TAMD-NN)
   - Posts the kickoff message to `#vince-agentic-workflow-demos` at
     channel root, prefixed `[TAMD-NN]`
   - Branches `TAMD-NN/free-shipping-badge` off main
   - Makes the code change with `data-testid` attributes consistent with
     nearby conventions
3. **Phase 2 (Planning) — plan-mode gate.** The orchestrator runs
   `node scripts/orchestrator-plan/detect-blast-radius.js --base main`.
   - For this *low-blast* example (cart UI tweak, no auth/API/store
     touched, < 200 LOC) → detector returns `blast_radius: "low"`,
     orchestrator skips the plan post and proceeds.
   - For a *high-blast* change (e.g. auth modification), the detector
     would return `blast_radius: "high"`, the orchestrator would post
     a structured plan to Jira, and **stop and wait for the human to
     reply Approved** before continuing. Show this branch by deliberately
     editing `src/lib/auth-crypto.ts` in a follow-up demo run.
4. Phase 3 (Implementation):
   - Runs the pre-PR DoD: `npm run test:coverage` (90% gate), then
     `git diff --name-only main | ./scripts/mabl-suggest-tests.sh`
   - Commits with message `TAMD-NN: ...`, pushes, opens the PR, and
     arms auto-merge: `gh pr merge <N> --auto --merge --delete-branch`

3. **Tab-switch: GitHub PR.** Show the structured PR body, the
   `test-impact-analysis` PR comment, and the 5 status checks queueing.

4. **Tab-switch: Slack.** Watch `ci-notify.sh` post each gate transition
   in real time:
   - `:white_check_mark: [TAMD-NN] Passed: Stage 1 · code quality` —
     coverage %, test counts, "ticket moving to *In Progress*"
   - `:white_check_mark: [TAMD-NN] Passed: T1 newman smoke (Preview)` —
     11 requests, 37 assertions, ~2s
   - mabl's native Slack app posts the `CSH-SMOKE-PR` plan run with
     screenshots and assertion details (sits alongside our `[TAMD-NN]`
     posts naturally)
   - `:white_check_mark: [TAMD-NN] Passed: Merge-ready` — all 7 required
     checks green, merge button live

5. **Phase 4 (Review) → Auto-merge fires.** Once all 7 required checks
   green, auto-merge fires. Branch deletes, prod deploy starts. Slack
   posts:
   - `:white_check_mark: [TAMD-NN] Passed: T1 newman smoke (Prod)`
   - `:white_check_mark: [TAMD-NN] Passed: Shipped to production` —
     ticket transitioning to *Done*

6. **Tab-switch: Jira.** Show TAMD-NN status now Done, with the gate-by-gate
   comments forming the audit trail.

7. **Tab-switch: live site.** The change is on
   `cheap-shot-hockey.vercel.app`.

**mabl value shown:** browser-layer gate on PR, smart-locator stability,
post-deploy verification, full audit trail across Jira + Slack + mabl.

---

## Act 3 — Auto-healing under change (4 min)

**Story:** "The team renames a button. The mabl test would have broken
in a brittle framework. Watch what happens here."

1. **Intentional break:** in Claude Code, prompt *"Change the login
   button text from 'Log in' to 'Sign in', and remove its `data-testid`."*
2. The orchestrator opens a follow-up ticket + PR.
3. **Tab-switch: mabl.** When `CSH-SMOKE-PR` runs, mabl's smart locators
   re-anchor on the visible label — test still passes. Show the locator
   view: "auto-healed at step 3, replaced selector with
   `text=Sign in`."
4. **Intentional full break:** prompt *"Now remove the login button
   entirely."* The `CSH-SMOKE-PR` gate fails. PR is blocked — auto-merge
   stays armed but won't fire. Show the Slack
   `:rotating_light: [TAMD-NN] BLOCKED` post and the mabl screenshot.
5. **Triage in-flight:** prompt *"Use mabl `analyze_failure` on the last
   plan run for this PR and tell me what broke."* Claude reads the run
   and posts a summary as a Jira comment. Push a fix → CI re-runs →
   green → auto-merge fires.

**mabl value shown:** auto-healing under cosmetic change, hard failure
on actual regression, AI-driven failure attribution, intelligent merge
gating.

---

## Act 4 — Continuous production monitoring (4 min)

**Story:** "Deploy landed. Now mabl watches production for you."

1. In mabl, show the **scheduled run** of `CSH-SMOKE-POSTDEPLOY` on a
   recurring schedule against Prod (e.g. every 15 min).
2. Run `./scripts/demo-toggle.sh flaky` — production now intermittently
   fails (~25% of API calls stall, ~20% return 503).
3. Wait for the next scheduled run (or trigger one manually via
   `./scripts/mabl-deployment.sh --labels type-smk,exec-postdeploy ...`).
4. Show mabl detecting the flake, grouping the failures, and routing
   them to Slack via mabl's native app.

**mabl value shown:** synthetic monitoring, flake detection, incident
routing without instrumentation work.

---

## Act 5 — Closed-loop failure response (4 min)

**Story:** "Post-deploy mabl flagged a regression. The deterministic
alert lands in Slack, a human reads the failure detail, and Claude
Code drives the fix."

1. **Set up the failure.** Open a small benign-looking PR through the
   normal flow (Act 2). Just before the merge fires, run
   `./scripts/demo-toggle.sh broken` — prod will return 503 once the
   merge deploys.
2. **Watch the chain.** Merge fires → Vercel deploys →
   `T1 newman (Prod)` fails → `mabl CSH-SMOKE-POSTDEPLOY (Prod)` fails →
   `scripts/ci-notify.sh fail "Prod post-deploy failed"` posts a
   `:rotating_light:` Slack message with links to the failing run +
   the mabl plan + the prod URL.
3. **Tab-switch: Slack.** The deterministic post is short and
   actionable — no AI handwaving, just "here's what failed, here's
   where to look."
4. **Closed-loop fix in Claude Code.** Prompt: *"Look at the latest
   post-deploy failure in Slack. The mabl run shows /api/health 503s.
   Triage and act."* Claude reads the mabl detail, spots the demo
   toggle in the build-info endpoint, flips it back, drives the fix
   through Acts 2–3.
5. Reset with `./scripts/demo-toggle.sh normal`.

**Why this matters for the customer:** the post-deploy chain is
deterministic by design — no LLM in the path between failure and
alert. The interactive Claude Code session (in your IDE) is where
human-in-the-loop triage happens. An earlier implementation included
an autonomous LLM-driven recovery agent (preserved at git tag
`archive/recovery-agent-and-receipts-v1`); v1 ships without it to
keep the prod-side surface tight.

**mabl value shown:** clear failure attribution, closed-loop fix via
the human + interactive Claude pair, no autonomous prod-side LLM.

---

## What's autonomous vs what needs Claude in the seat

Important honesty for customer demos:

| Surface | Autonomous? | Needs human? |
| --- | --- | --- |
| GHA workflow + branch protection + auto-merge | Yes | No |
| `ci-notify.sh` Slack + Jira posts at every gate | Yes (when `SLACK_WEBHOOK_URL` is set) | No |
| Jira lifecycle transitions (To Do → In Progress → Done) | Yes | No |
| Vercel deploy on main push | Yes | No |
| Initial prompt to Claude Code | No | Yes |
| Subagent orchestration (creates ticket, branch, PR) | Yes (after the prompt) | No |
| `pr-reviewer` convention audit | Yes (when invoked) | No |
| Post-deploy failure alert (deterministic Slack/Jira) | Yes | No |
| Triaging a post-deploy failure (decide revert vs forward-fix, act) | No — v1 has no autonomous LLM diagnosis | Yes |
| **Security gate** (`npm audit`) — **required as of 2026-05-21** (PR #82); CodeQL stays advisory | Yes (every PR + main push, plus weekly CodeQL cron) | No |
| **Dependabot** weekly dep PRs (npm + github-actions) | Yes (PRs go through full SDLC pipeline) | No |

The Claude Code subagents run in an interactive session — they need
Claude in the seat to drive. The CI pipeline they kick off is fully
autonomous past that point. For a customer fork that wants headless
end-to-end autonomy, the orchestrator subagent's logic ports to an
Agent SDK `query()` call invoked from a webhook handler (Phase 2).

---

## Demo driver shortcuts

| What you want | Command |
| --- | --- |
| Flip production into a slow / flaky / broken state | `./scripts/demo-toggle.sh slow` (or `flaky` / `broken`) |
| Reset prod to normal | `./scripts/demo-toggle.sh normal` |
| Kick off a mabl smoke manually against Prod | `./scripts/mabl-deployment.sh --labels type-smk,exec-postdeploy --environment $MABL_ENV_PROD_ID --application $MABL_APPLICATION_ID --url https://cheap-shot-hockey.vercel.app --wait` |
| Run mabl test impact analysis locally | `git diff --name-only main \| ./scripts/mabl-suggest-tests.sh` |
| See the current prod build | `curl https://cheap-shot-hockey.vercel.app/api/build-info` |
| Check API health | `curl https://cheap-shot-hockey.vercel.app/api/health` |
| Install pre-push T1 hook | `./scripts/install-git-hooks.sh` |

---

## Optional enhancements (not required for the demo)

- **Feature-flag wrap** — orchestrator wraps net-new UI in a flag and
  ships at 0%, then a follow-up "ramp" PR moves to 100% after a soak
  window. Operational maturity story.
- **LLM cost aggregation in the cycle-time receipt** — v1's receipt
  covers lead time, GHA minutes, mabl minutes, CI attempts, and
  human touches. Per-LLM-run cost capture is preserved at git tag
  `archive/recovery-agent-and-receipts-v1` for forks that want it.
- **Autonomous recovery agent** — Agent SDK loop that runs on
  post-deploy failure, emits a structured `revert` / `forward-fix` /
  `page-human` recommendation. Implementation preserved at git tag
  `archive/recovery-agent-and-receipts-v1`. Requires an
  `ANTHROPIC_API_KEY` repo secret.
- **Datadog / Grafana tie-in** — overlay mabl pass-rate on the latency
  dashboard for one screen ("correctness × performance").
- **k6 load test in parallel** — "mabl proves correctness, k6 proves
  performance, together they gate the release."
