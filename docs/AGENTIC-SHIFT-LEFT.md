# The Agentic mabl Shift-Left Workflow

This is the customer-facing narrative. It follows the same four-phase
lifecycle as the classic mabl shift-left diagram (`ticket → prod`),
but with **AI agents inside every loop** — picking up tickets, writing
code, running mabl tests, filing defects back to Jira, and fixing.

The human is the product owner setting direction and approving gates.
Agents do the execution.

For the sequential live-demo script (what to say, when), see
`DEMO-TICKET-TO-PROD.md`.

---

## Phase map

| Phase | Trigger | Primary agent | Mabl's role | Artifact on failure |
| --- | --- | --- | --- | --- |
| **In-Sprint Development** | Dev pulls ticket | Claude in IDE | Local API + browser tests via `mabl-cli` | Jira defect + loop back |
| **Regression** | Branch pushed | Jenkins + Claude review agent | Cloud regression (parallel, cross-browser) | Jira defect + loop back to dev |
| **Deployment** | Regression green + approval | Jenkins | — (gate only) | Block promotion, rollback |
| **Post-Deployment** | Prod deploy lands | Scheduled mabl + triage agent | Post-deploy smoke + continuous monitoring | Jira defect + loop back to dev |

Every loop-back arrow in the traditional diagram becomes a **Claude
invocation** in the agentic version.

---

## Phase 1 — In-Sprint Development

**Goal:** ship a change to `main` with tests that reflect the new
surface, without waiting for a separate QA pass.

### Steps

```
 ┌─ Jira ticket assigned ──────────────────┐
 │                                         │
 │  1. Dev agent reads the ticket          │
 │  2. Writes the code change              │
 │  3. Authors / updates mabl tests        │
 │  4. Runs local API tests  ◄─────────┐   │
 │     └─ errors? → fix locally ───────┤   │
 │  5. Runs local targeted browser     │   │
 │     tests                            │   │
 │     └─ errors? → fix locally ───────┤   │
 │  6. Review agent reads the diff     │   │
 │  7. Commit + push                   │   │
 │                                         │
 └─────────────────────────────────────────┘
```

### Who does what

- **Dev agent (Claude in IDE):**
  - Calls the Atlassian MCP → reads the Jira ticket including acceptance
    criteria.
  - Reads `CLAUDE.md` for the repo's conventions.
  - Writes the code change.
  - Checks `get_mabl_tests` for existing coverage of the affected surface.
  - If coverage is missing, calls `plan_new_test` → `create_mabl_test_cloud`
    to author a new test and attach it to the `pr-gate` plan.
- **mabl-cli:** runs the local tests against `http://localhost:3000`
  (the **Local** environment in the workspace).
- **Review agent (Claude `/review` skill):** reads the diff, flags
  anything that violates `CLAUDE.md` conventions or common smells.
- **Human:** approves the diff before push.

### What happens on failure

Agent finds a failing local test → reads the failure artifact (mabl
writes one on every run) → proposes a fix → re-runs → iterates until
green. **No human intervention** unless the agent can't converge.

If the fix reveals a deeper issue that should be tracked separately,
the agent files a Jira defect via the Atlassian MCP
(`createJiraIssue`) and links it to CSH-42.

**Commands on the driver's laptop:**

```bash
# local API test
mabl tests run --test <api-smoke-id> --environment-id DmlIvADtF8jPDm9J7Bpshw-e

# local browser test
mabl tests run --test <product-detail-id> --environment-id DmlIvADtF8jPDm9J7Bpshw-e
```

---

## Phase 2 — Regression

**Goal:** before merging, verify the full existing test suite still
passes against a preview deploy of the change.

### Steps

```
 ┌─ Push → Vercel preview URL ─────────────┐
 │                                         │
 │  1. Jenkins polls SCM, picks up push    │
 │  2. Jenkins runs:                       │
 │     ├─ npm ci + npm run build           │
 │     ├─ mabl api-smoke (Preview env)     │
 │     └─ mabl pr-gate  (Preview env)      │
 │     └─ errors? → triage agent opens     │
 │                 Jira defect → loop back ◄────► Phase 1
 │  3. Cloud regression runs on Preview    │
 │     (full parallel cross-browser)       │
 │     └─ errors? → triage agent opens     │
 │                 Jira defect → loop back ◄────► Phase 1
 │  4. Merge to main                       │
 │                                         │
 └─────────────────────────────────────────┘
```

### Who does what

- **Jenkins:** build + dispatch mabl deployment events with labels
  `api-smoke` and `pr-gate`.
- **mabl cloud:** runs plans in parallel across Chrome / Firefox / Webkit.
- **Triage agent (Claude):** on failure, calls mabl MCP `analyze_failure`
  with the plan run id, reads the journey + the DOM state at failure,
  then:
  1. Creates a Jira defect via Atlassian MCP, linked to the feature
     ticket, with the failure link + proposed root cause.
  2. If the failure is in the dev's own change, pushes a fix commit to
     the same branch.
  3. Re-triggers Jenkins.
- **Human:** reviews the PR, approves the merge once everything green.

### What's different from the traditional flow

Classic flow has the dev read the failure, decide if it's real, file a
defect manually, and fix. The agentic flow collapses those steps into
**one MCP call chain** — and because the agent works inside the repo
context, it can usually push a fix commit in the same minute the
failure lands.

**Commands:**

```bash
# manually trigger cloud regression on the preview branch
./scripts/mabl-deployment.sh \
  --environment TpuarWvfj1hOREDT0JGvjA-e \
  --application OZqmshBkUfVSesWy49g1eQ-a \
  --labels regression \
  --url "https://cheap-shot-hockey-git-<branch>-vincemahan-1163s-projects.vercel.app" \
  --commit "$(git rev-parse --short HEAD)" \
  --branch "$(git branch --show-current)" \
  --wait
```

---

## Phase 3 — Deployment

**Goal:** promote the merged commit to production with zero ceremony.

### Steps

```
 ┌─ Merge to main ─────────────────────────┐
 │                                         │
 │  1. Vercel auto-deploys main            │
 │  2. Jenkins main-branch pipeline runs:  │
 │     └─ wait for /api/build-info to      │
 │        report the new commit            │
 │  3. Promotion is implicit (Vercel)      │
 │     OR explicit in other orgs:          │
 │       helm upgrade / kubectl apply      │
 │       / aws ecs update-service          │
 │                                         │
 └─────────────────────────────────────────┘
```

### Who does what

- **Jenkins:** waits for the deploy to reflect the new commit.
- **Human:** none.
- **Agents:** none at this phase — the deploy is gated on the previous
  phases already having passed.

### What's different

In the traditional flow, this step is often a manual promote-RC button.
In the agentic flow, the prior phases gave enough confidence that the
promote is automatic. **Humans get their time back for decisions, not
gatekeeping.**

---

## Phase 4 — Post-Deployment

**Goal:** verify production is healthy on the new commit, and catch any
issues scheduled runs surface later.

### Steps

```
 ┌─ Prod deploy complete ──────────────────┐
 │                                         │
 │  1. Jenkins runs post-deploy smoke      │
 │     └─ errors? → triage agent opens     │
 │                 Jira defect → loop back ◄────► Phase 1
 │                 + rollback              │
 │  2. Scheduled mabl runs every 15m       │
 │     against prod                        │
 │     └─ new failure? → triage agent      │
 │                 opens Jira defect +      │
 │                 posts PR with a fix ────► Phase 1
 │                                         │
 └─────────────────────────────────────────┘
```

### Who does what

- **Jenkins:** triggers the `post-deploy-smoke` plan immediately after
  the prod deploy completes.
- **mabl cloud:** runs `post-deploy-smoke` against the live URL + runs
  scheduled `regression` every 15 min.
- **Triage agent (Claude):** on failure:
  1. `analyze_failure` with the failed journey.
  2. Cross-reference: is there a `?demo=` toggle currently flipped in
     prod? If yes, reset it with `scripts/demo-toggle.sh normal` and
     move on — no defect.
  3. If no demo toggle and real failure: file a Jira incident ticket,
     post to the on-call Slack channel, draft a revert PR.
- **Human:** approves the revert PR or takes manual control.

### Commands

```bash
# manual post-deploy smoke
./scripts/mabl-deployment.sh \
  --environment vwf8Vni5e7H0XTfT5hbi6w-e \
  --application OZqmshBkUfVSesWy49g1eQ-a \
  --labels post-deploy-smoke \
  --url "https://cheap-shot-hockey.vercel.app" \
  --wait

# pull the last prod failure for triage
./scripts/mabl-analyze-last-failure.sh
```

---

## What makes this workflow *agentic* (the elevator pitch)

Every loop-back arrow in the classic diagram used to be a human
cost — read the failure, decide if it's real, file a defect, fix,
rerun. In the agentic workflow:

- **Ticket pickup** is an agent reading Jira via the Atlassian MCP.
- **Code authoring** is an agent respecting `CLAUDE.md` conventions.
- **Test authoring for new surfaces** is an agent via the mabl MCP
  (`plan_new_test` → `create_mabl_test_cloud`).
- **Local test execution** is an agent running `mabl tests run` and
  reading the artifact JSON.
- **Failure triage** is an agent calling `analyze_failure` and writing
  a defect or a fix.
- **Code review** is an agent invoking the `/review` skill.
- **Post-deploy monitoring** is scheduled mabl + a triage agent on
  standby.

**The developer becomes the product owner.** The agents do the round
trips. The humans ratify the bigger decisions at three moments: accept
the diff before push, approve the PR before merge, and (rarely) approve
a production rollback.

Mabl is the source of truth for *did it work?* at every gate. The AI
is the throughput multiplier on every fix-and-retry loop between those
gates.

---

## How each agent is configured

| Agent | Runs as | Scope | Auth |
| --- | --- | --- | --- |
| Dev agent (IDE) | Claude Code CLI in IDE terminal | Repo workspace | Claude Pro / Max subscription |
| Review agent | Claude `/review` skill locally, OR the Claude GH App on PRs | Diff + CLAUDE.md | `CLAUDE_CODE_OAUTH_TOKEN` repo secret |
| Test author (mabl MCP) | Called from dev agent | mabl workspace | mabl API token |
| Triage agent (mabl + Jira) | Called on CI failure or prod incident | mabl + Atlassian MCP | mabl API token + Atlassian OAuth |
| CI orchestrator | Jenkins (local) + GHA mirror | Pipeline | mabl API token as Jenkins/GH secret |

All the pieces above are **already wired** in this workspace — see
`CLAUDE.md`, `Jenkinsfile`, `.github/workflows/claude.yml`, and
`.github/workflows/mabl-sdlc.yml`.

---

## Sequence diagram (ASCII, for the deck)

```
Jira       Dev agent        mabl-cli / mabl cloud        Jenkins          Triage agent         Human
 │             │                      │                     │                  │                  │
 │ Ticket ────►│                      │                     │                  │                  │
 │             │ ── read ─────────────►                     │                  │                  │
 │             │ write code           │                     │                  │                  │
 │             │ ── run local API ───►│                     │                  │                  │
 │             │ ──  run local UI ───►│                     │                  │                  │
 │             │                      │                     │                  │  approve diff ──►│
 │             │ ── push ────────────────────────────────►  │                  │                  │
 │             │                      │ preview smoke ◄──── │                  │                  │
 │             │                      │ pr-gate      ◄──── │                  │                  │
 │             │                      │ cloud regression ◄──│                  │                  │
 │                                                            failure? ──────► │                  │
 │ defect ◄───────────────────────────────────────────────────                 │  push fix ◄──────│
 │ (linked)                                                                    │                  │
 │             │                      │                     │ merge ◄──── approve PR ◄────────────│
 │                                                            prod deploy      │                  │
 │                                                            post-smoke ◄──── │                  │
 │ incident ◄─────────────────────────────────────────────────────── on failure, triage agent    │
```

---

## What to pitch to customers (one paragraph)

> Your classic mabl shift-left loop stays — it's proven — but inside
> every arrow, a Claude agent now executes the human round trips. The
> developer spends their time on the change itself, not on running
> tests, reading failures, filing tickets, or rerunning CI. mabl remains
> the source of truth at every gate. Adoption is incremental: pick any
> one loop — say, triage — and swap the human step for an agent call.
> Measure the time saved; repeat on the next loop.
