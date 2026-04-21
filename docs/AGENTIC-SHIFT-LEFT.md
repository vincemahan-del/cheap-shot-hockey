# The Agentic mabl Shift-Left Workflow

The classic four-phase mabl lifecycle stays. What changes is **what
lives inside each loop** — and how much of each loop a human actually
has to touch.

This is the practical version. Everything labeled **Tier 1** or
**Tier 2** works today on commodity tooling (mabl + your CI + Claude
Code). **Tier 3** is where the industry is going — some of it is live,
some still needs organizational trust to adopt.

Nothing here is hype. Every capability maps to a real API call, a
script in this repo, or a concrete organizational decision.

---

## The four phases (customer mental model)

1. **In-Sprint Development** — dev pulls a ticket, makes the change
2. **Regression** — verify the full existing suite still passes before merge
3. **Deployment** — promote the merged commit to production
4. **Post-Deployment** — verify prod, catch issues after launch

This is the diagram on the whiteboard. Don't fight it. Every team
already thinks in these phases — the question is *how* each phase
executes.

---

## The three tiers (the maturity you're leading customers toward)

Inside every phase, the same workflow exists at three tiers:

| Tier | What it is | Who runs it | Ready today? |
| --- | --- | --- | --- |
| **T1 — Human-driven** | Dev/QA does every step. Tests run when someone remembers to. | Humans, occasional CI | Everywhere |
| **T2 — Agent-assisted** | Agents do the round-trips (running tests, filing defects, proposing fixes). Humans approve gates. | Claude + mabl + CI | Yes — this repo shows it |
| **T3 — Agent-autonomous (on low-risk)** | Agents auto-ship changes that meet a risk threshold. Humans review exceptions, not defaults. | Same tooling + a team decision about risk tolerance | Pieces yes, full picture requires policy |

The best advice you can give a customer: **pick one loop, move it from
T1 to T2, measure. Repeat.** Don't try to vault from T1 to T3.

---

## Phase 1 — In-Sprint Development

### T1 (familiar baseline)

Dev reads the ticket in Jira. Writes code. Runs tests manually in the
IDE. Fixes what fails. Pushes.

*Pain points:* coverage gaps surface late; local tests drift from cloud
tests; devs often skip the test step under pressure.

### T2 (agent-assisted, works today)

Dev opens an IDE terminal, runs `claude`, pastes a single prompt like
*"read Jira ticket CSH-42 and implement it following CLAUDE.md. List
any existing mabl tests affected."* The agent:

- Reads the ticket via the Atlassian MCP.
- Reads `CLAUDE.md` for the repo's conventions.
- Writes the change.
- Calls the mabl MCP to list existing tests touching the affected surface.
- Runs a local mabl test via `mabl-cli` against `localhost:3000`.
- Reports a summary: diff, test result, any coverage gaps.

The dev approves the diff. That's the gate.

**What makes this real, not hype:** the Atlassian MCP is a published
tool. `mabl-cli` is a shipped binary. Claude Code runs on your Pro/Max
subscription. No vaporware.

### T3 (emerging — choose how far to go)

Two things upgrade from T2 → T3:

**(a) Coverage-driven test authoring, on its own.** The agent doesn't
wait for you to ask — when it sees a new interactive surface with no
corresponding test, it calls `plan_new_test` → `create_mabl_test_cloud`
and attaches the new test to the `pr-gate` plan. Ready today; requires
trusting the agent to pick test intents on its own.

**(b) Auto-commit on low-risk changes.** If the agent's own mabl tests
pass AND the diff is within a pre-agreed risk envelope (renames,
copy changes, CSS, etc.), it pushes without asking. Requires
organizational policy: *"these classes of changes don't need a human
review gate."* Technology is ready; process usually isn't.

**Honest call for customers:** (a) is a 90-day adoption. (b) is a
12-month conversation that starts with risk taxonomy.

---

## Phase 2 — Regression

### T1 (familiar baseline)

CI runs tests on PR open. Dev reads failures. Decides if it's real.
Files a defect if so. Fixes. Rerun. Merge when green.

### T2 (agent-assisted, works today — this repo shows it)

- `Jenkinsfile` dispatches mabl deployment events on branch push.
- `mabl api-smoke` + `mabl pr-gate` plans run against the Vercel
  preview URL, in parallel across Chrome / Firefox / Webkit.
- **On failure:** a triage agent (Claude) calls `analyze_failure` with
  the plan run id, reads the DOM state + failure message, then either
  (a) files a linked Jira defect via the Atlassian MCP, or (b) if the
  failure is in the dev's own change, pushes a fix commit to the same
  branch.
- Pipeline re-runs automatically.
- Human reviews the PR + the triage agent's comment, merges when
  ready.

The key upgrade from T1: **the triage loop used to be hours** (dev
gets pinged, context-switches, reads the failure, decides, opens a
ticket). It's now **minutes**, and the fix commit often lands before
the dev even looks at the PR.

### T3 (emerging)

**Continuous regression instead of gated regression.** Today,
regression is a phase with a defined start (PR open) and end (merge).
T3 runs regression continuously as a background signal — mabl is
always executing plans against every open PR, and a **risk score**
rolls up pass/fail history + coverage + diff size into a number.
Merges with risk < threshold auto-approve.

Ready today piece-by-piece: scheduled mabl runs exist, mabl coverage
exists, risk scoring is custom code you'd write around them. Nobody's
shipped a packaged "risk dashboard" yet — this is where mabl customers
have a chance to build something distinctive.

---

## Phase 3 — Deployment

### T1 (familiar baseline)

Manual promote-RC ceremony. Release manager clicks the button.
Sometimes a smoke test runs after; sometimes not.

### T2 (agent-assisted, works today)

- Merge to main triggers Vercel (or your deploy target) automatically.
- Jenkins waits for `/api/build-info` to report the new commit.
- `mabl post-deploy-smoke` runs immediately after the deploy lands.
- **Agent role is minimal at this phase** — the prior phases did the
  work. If post-deploy smoke fails, it's Phase 4's problem.

### T3 (emerging)

**Progressive rollout with mabl as the live signal.** Instead of one
big bang deploy, the new commit serves 1% → 10% → 100% of traffic.
Mabl's synthetic runs target each slice. Error budget breach → agent
automatically rolls back.

Ready today with a feature-flag platform + mabl's synthetic API. No
mabl customer I know is doing this yet — this is an opinionated play
you can lead on.

---

## Phase 4 — Post-Deployment

### T1 (familiar baseline)

Scheduled runs maybe (if someone set them up). On-call engineer reads
PagerDuty. Triages manually. Files a ticket. Fixes later.

### T2 (agent-assisted, works today — this repo shows it)

- `mabl post-deploy-smoke` runs after every prod deploy.
- Scheduled `regression` plan runs every 15 min against production.
- On failure, the triage agent:
  1. Calls `analyze_failure`.
  2. Cross-references known conditions (is there a `?demo=` toggle
     flipped? is there an active feature flag ramp?).
  3. If real incident: files a Jira incident ticket + posts to Slack +
     drafts a revert PR.
  4. If false positive: notes it, doesn't page.
- On-call engineer reads one clear triage summary, not five raw
  failure traces.

### T3 (emerging)

**Agents that play the app in prod**, finding regressions no scheduled
test would cover. Novel test authoring happens continuously in prod, and
any new failure mode gets promoted into the pre-merge `pr-gate` plan.
This closes the loop: **every prod bug becomes a pre-merge test
automatically**.

Ready today in pieces. The missing glue is an agent loop configured to
explore the app with a "find something mabl doesn't already cover"
objective. Someone will ship this in 2026.

---

## What to tell customers in the first meeting

> "Keep your four-phase lifecycle — we aren't replacing it. What we
> are doing is putting a Claude agent inside every round trip the
> humans used to make. Start with the triage loop in regression —
> that's the highest-ROI first step. A quarter later, add the
> coverage-driven test authoring in-sprint. A quarter after that,
> move post-deploy to continuous. We're happy to walk you through
> exactly which pieces plug together — it's all real tooling, no
> hype."

That paragraph maps to:
- Q1 adoption: T2 in Phase 2 (triage agent on CI)
- Q2 adoption: T2 in Phase 1 (coverage-driven test authoring)
- Q3 adoption: T2 in Phase 4 (continuous monitoring with triage agent)
- Q4+ conversation: selective T3 (risk-scored autoship, progressive
  rollout, exploratory test agents)

This is a **believable, non-hype adoption path** you can put on a
deck slide.

---

## What's still required to make this land well

None of this is magic. Before a customer can adopt even T2, they need:

- **Stable selectors.** `data-testid` everywhere. mabl auto-healing
  reduces pressure, but a clean selector strategy is still a
  prerequisite.
- **A mabl plan-label taxonomy.** `api-smoke`, `pr-gate`,
  `regression`, `post-deploy-smoke` at minimum. These are the labels
  CI dispatches against; without them, the agents have nothing to run.
- **A single `CLAUDE.md` per repo.** Without it, Claude makes
  plausible-looking changes that violate the team's conventions. With
  it, agents are dramatically more consistent.
- **CI hooks that survive unattended.** The Jenkinsfile here, the GHA
  workflow, and the Claude Code action are all idempotent and
  fire-and-forget. If your CI requires human intervention at any
  point, the agent loops break.
- **An OAuth or API token strategy that passes IT.** Claude OAuth
  tokens (via `claude setup-token`) bypass most console-access
  restrictions. mabl API tokens are scoped to the workspace. Both
  store as secrets, not in the repo.

Each of these is a 1–2 day engineering task; together they unblock
the full workflow.

---

## How each agent is wired (for the architect in the room)

| Agent | Runs as | Called at | Auth |
| --- | --- | --- | --- |
| Dev agent (IDE) | `claude` CLI in IDE terminal | Dev picks up a ticket | Claude Pro/Max |
| Review agent | Claude `/review` skill locally + Claude GH App on PRs | Before push + on PR open | `CLAUDE_CODE_OAUTH_TOKEN` secret |
| Test-author agent (mabl MCP) | Subroutine of dev or review agent | Coverage gap detected | mabl API token |
| Triage agent (mabl + Jira) | Workflow job + GH App | CI failure or scheduled-run failure | mabl API token + Atlassian OAuth |
| CI orchestrator | Jenkins + GHA mirror | Push / PR / schedule | mabl API token as Jenkins/GH secret |

All wired in this repo. See `Jenkinsfile`, `.github/workflows/*.yml`,
`CLAUDE.md`, and `scripts/mabl-*.sh`.

---

## What to skip for a sharper story

For a 30-minute customer meeting:

- Don't show T3 speculative capabilities. Mention them once, return to
  T2.
- Don't start with tooling — start with the loop the customer's own
  engineers hate most. Then show which tier eliminates it.
- Don't try to cover all four phases in one demo. Pick the two that
  map to the customer's current pain.

For a workshop or deeper follow-up:

- Walk the T1 → T2 delta in one phase end-to-end. Measure the time
  diff live.
- Run `scripts/demo-toggle.sh broken` to show the triage agent
  actually closing the loop on a real (simulated) prod incident.
- Show `analyze_failure` output alongside the raw mabl result — the
  before/after is the sale.

---

## Reference files in this repo

- `Jenkinsfile` — the CI pipeline that dispatches mabl deployment events
- `.github/workflows/mabl-sdlc.yml` — GHA mirror
- `.github/workflows/claude.yml` — the Claude Code Action responding to
  `@claude` mentions
- `scripts/mabl-deployment.sh` — mabl REST event + poll loop
- `scripts/mabl-analyze-last-failure.sh` — the primitive the triage
  agent wraps
- `scripts/demo-toggle.sh` — flip prod into broken/flaky/slow for
  demos
- `CLAUDE.md` — the brief every Claude agent reads before touching code
- `docs/DEMO-TICKET-TO-PROD.md` — the driver's script for the live demo
