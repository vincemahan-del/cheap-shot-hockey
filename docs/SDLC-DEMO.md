# Cheap Shot Hockey — mabl full-SDLC demo runbook

A stage-by-stage script for demoing mabl's value across the entire software
delivery lifecycle, built on top of this repo + the Jenkinsfile + mabl API.

Expected runtime: **20–30 minutes** for a full walkthrough. Each act is
self-contained, so you can shorten to any subset.

---

## Narration surfaces (no Slack required)

The demo runs across four visible screens. Have these open in tabs before
you start — tab-switching as each gate fires is the narration.

| Screen | URL / app | What the customer sees |
| --- | --- | --- |
| **VS Code** | Claude Code terminal | Agent reasoning, MCP calls, Jira comments posting live |
| **GitHub PR** | `github.com/<repo>/pull/<N>` | DoD comment, status checks updating in real time |
| **Jenkins** | `localhost:8080` (Blue Ocean) | Pipeline stage progression, mabl poll loop in logs |
| **mabl** | `app.mabl.com` → plan run | Tests running live, smart locator healing, failure screenshots |
| **Jira** | `mabl.atlassian.net/browse/TAMD-N` | Comments auto-posting, ticket transitioning To Do → In Progress → Done |

**Opening line for the customer:**
> "The engineer types one prompt in Claude Code. Watch what happens across every system."

Then don't talk — let the agent run. Tab-switch as each gate fires.

---

## Before the demo

### Provision mabl

1. **Workspace:** create or pick one. Capture the workspace UUID.
2. **Application:** add "Cheap Shot Hockey". Capture the application UUID.
3. **Environments:** create two — **preview** and **production**. Point
   them at `https://cheap-shot-hockey-git-<branch>.vercel.app` and
   `https://cheap-shot-hockey.vercel.app` respectively. Capture the UUIDs.
4. **Credentials:** add `demo@cheapshot.test` / `demo1234` for both envs.
5. **API token:** Settings → APIs → create a fresh token. Copy it.
6. **Seed a suite:** either import the OpenAPI spec at
   `https://cheap-shot-hockey.vercel.app/api/openapi`, or use the mabl MCP
   to scaffold tests from Claude Code.

Label the resulting plans with:

- `api-smoke` — fast API plans (<60s) that run on every commit
- `pr-gate` — ~3 critical UI journeys (login, add-to-cart, checkout)
- `regression` — full suite, runs on merge to main
- `post-deploy-smoke` — 1 UI + 1 API, runs against prod after deploy

### Provision CI

**Jenkins (primary):**

```bash
docker compose -f docker-compose.jenkins.yml up -d
open http://localhost:8080
# follow unlock instructions, install recommended plugins
# add "mabl-api-token" credential (String, scope: global)
# New Item → Pipeline → "Pipeline script from SCM" → this repo URL
```

Set these global env vars in **Manage Jenkins → System**:

| Variable | Value |
| --- | --- |
| `MABL_WORKSPACE_ID` | your workspace UUID |
| `MABL_APPLICATION_ID` | your application UUID |
| `MABL_ENV_PREVIEW_ID` | preview env UUID |
| `MABL_ENV_PROD_ID` | production env UUID |
| `PRODUCTION_URL` | `https://cheap-shot-hockey.vercel.app` |

**GitHub Actions (parallel path):** set the same values as repo secrets.
The workflow at `.github/workflows/mabl-sdlc.yml` mirrors the Jenkins
pipeline.

---

## Act 1 — Shift-left authoring (3 min)

**Story:** "Developer is adding a new feature and wants to lock in
coverage before they even push."

**Screen: VS Code (Claude Code)**

1. Open Claude Code in this repo.
2. Prompt: *"I'm adding a wishlist feature at `/wishlist`. Use the mabl
   MCP to draft a UI test that logs in, adds a product to the wishlist,
   and verifies it persists after refresh."*
3. Claude calls `mabl plan_new_test` → `create_mabl_test_cloud` →
   `get_cloud_test_gen_status`. Customer watches each MCP call appear in
   the chat pane — this is the "agentic authoring" moment.

**Tab-switch: mabl**

4. Open the mabl workspace — the new test is there, already wired to
   the preview environment. Point out: no one wrote a test script, the
   agent scaffolded it from a plain-English description.

**Mabl value shown:** AI-native authoring, MCP integration,
shift-left QA investment.

---

## Act 2 — PR gate (6 min)

**Story:** "PR opens. Pipeline runs. If any mabl test fails, the PR is
blocked."

**Screen: VS Code (Claude Code)**

1. Create a branch + make a small change (e.g., rename a button).
2. Prompt Claude: *"Open a PR for this change."* Claude runs the DoD
   checks (coverage gate, mabl test impact analysis) and posts the
   result as a PR comment before the branch is even pushed.

**Tab-switch: GitHub PR**

3. PR is open. Show the DoD comment at the top — coverage %, affected
   mabl tests listed, gaps noted. Branch protection status checks are
   queued and updating.
4. Jenkins/Actions trigger automatically.

**Tab-switch: Jenkins (Blue Ocean)**

5. **Watch the pipeline:** checkout → build → deploy preview →
   `mabl deployment` with labels `api-smoke` + `pr-gate`. Click into
   the mabl stage to show the poll loop waiting for results.

**Tab-switch: mabl**

6. Open the plan run — show the UI run in flight. Point out the smart
   locator view.
7. **Intentional break:** back in VS Code, change the login button's
   text, remove its `data-testid`. Push. Switch back to mabl — show
   auto-healing, test still passes because mabl re-anchored on the
   visible label.
8. **Intentional full break:** remove the button entirely. Pipeline
   fails.

**Tab-switch: VS Code (Claude Code)**

9. Prompt: *"There's a failing mabl run. Triage it."* Claude calls
   `analyze_failure` → explains the root cause in plain English →
   posts a Jira comment with the diagnosis.

**Tab-switch: Jira**

10. Show the auto-posted triage comment on the ticket. Customer sees
    the audit trail — failure, diagnosis, and fix all in one place.
11. Fix the PR → pipeline re-runs → green. GitHub status checks go
    green one by one.

**Mabl value shown:** auto-healing under change, intelligent failure
attribution, PR quality gate.

---

## Act 3 — Main pipeline → production (5 min)

**Story:** "PR is approved and merged. The pipeline runs the full
regression and promotes to prod."

**Screen: GitHub PR**

1. All checks green. Auto-merge fires (no human click needed — branch
   protection unblocks it). Show the merge happening automatically.

**Tab-switch: Jenkins (Blue Ocean)**

2. Main-branch pipeline triggers immediately. Walk the stages:
   - Stage 6: `mabl regression` — full plan set against the
     just-deployed prod URL.
   - Stage 7: Vercel auto-deploys (for non-Vercel orgs this is
     `helm upgrade` or similar, gated on stage 6).
   - Stage 8: `post-deploy smoke` — confirms the new commit is live
     via `/api/build-info`, then runs a small mabl plan against prod.

**Tab-switch: mabl**

3. Show the regression plan run completing. Point out test count and
   duration — this is the full suite, not just the PR gate subset.

**Tab-switch: Jira**

4. Ticket has auto-transitioned: In Progress → **Done**. The comment
   thread is a complete audit trail: PR opened → CI green → merged →
   deployed → verified. No one typed any of it.

**Mabl value shown:** regression confidence, deploy gate, post-deploy
assurance.

---

## Act 4 — Continuous production monitoring (4 min)

**Story:** "Deploy landed. Now mabl watches production for you."

**Screen: mabl**

1. Show the **scheduled deployment** running the `post-deploy-smoke`
   label every 15 min against prod. Point out: this runs forever,
   no one has to remember to trigger it.

**Screen: VS Code terminal (not Claude Code — raw terminal)**

2. Run `./scripts/demo-toggle.sh flaky` — production now intermittently
   fails (25% of API calls stall, ~20% 503). This simulates a real
   prod incident without touching code.

**Tab-switch: mabl**

3. Trigger a manual run or wait for the next scheduled one. Show mabl
   detecting the flake, grouping failures by root cause, and surfacing
   the incident. Point out the failure screenshot and the diff view
   against the last green run.

**Mabl value shown:** synthetic monitoring, flake detection, incident
routing.

---

## Act 5 — Triage + fix (4 min)

**Story:** "mabl flagged an incident. Engineer opens Claude, triages,
and ships a fix."

**Screen: VS Code (Claude Code)**

1. Prompt: *"There's a failing mabl run against prod. Triage it and
   draft a fix PR."*
2. Customer watches Claude call `mabl get_latest_plan_runs` →
   `analyze_failure` → read the relevant source files → propose a fix.
   This is the payoff moment — the agent closes the loop from incident
   to code change without the engineer having to do anything.
3. Claude opens the PR. DoD checks run. Auto-merge arms.

**Tab-switch: GitHub PR → Jenkins → mabl → Jira**

4. Walk the same tab sequence as Act 2 + Act 3, but faster — customer
   has seen it once, now they see it's repeatable. The ticket that was
   just created goes To Do → In Progress → Done in one unbroken chain.

**Screen: VS Code terminal**

5. Run `./scripts/demo-toggle.sh normal` to reset prod.

**Closing line:**
> "From mabl detecting the failure to a verified prod fix — no human
> wrote a test, no human filed a bug, no human merged the PR. The
> engineer just watched."

**Mabl value shown:** closed-loop AI incident triage, complete SDLC
coverage.

---

## Demo driver shortcuts

| What you want | Command |
| --- | --- |
| Flip production into a broken state | `./scripts/demo-toggle.sh broken` |
| Flip back to normal | `./scripts/demo-toggle.sh normal` |
| Kick off a mabl smoke manually | `./scripts/mabl-deployment.sh --labels api-smoke --environment $PROD --application $APP --wait` |
| Pull the last failure | `./scripts/mabl-analyze-last-failure.sh` |
| See the current prod build | `curl https://cheap-shot-hockey.vercel.app/api/build-info` |
| Check API health | `curl https://cheap-shot-hockey.vercel.app/api/health` |

---

## Optional enhancements (nice to have, not required)

- **Feature flags** — wire in a real flag provider so the demo can do
  a dark-launch → `mabl` gates the flag flip.
- **Slack bot** — post the `mabl-analyze-last-failure.sh` output to a
  demo Slack channel instead of stdout.
- **Datadog tie-in** — overlay mabl run pass rate on the Datadog
  latency dashboard.
- **k6 load test** alongside mabl — "mabl proves correctness, k6 proves
  performance, together they gate the release."
# TAMD-92 smoke test trigger
