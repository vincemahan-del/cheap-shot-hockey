# Cheap Shot Hockey — mabl full-SDLC demo runbook

A stage-by-stage script for demoing mabl's value across the entire software
delivery lifecycle, built on top of this repo + the Jenkinsfile + mabl API.

Expected runtime: **20–30 minutes** for a full walkthrough. Each act is
self-contained, so you can shorten to any subset.

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

1. Open Claude Code in this repo.
2. Prompt: *"I'm adding a wishlist feature at `/wishlist`. Use the mabl
   MCP to draft a UI test that logs in, adds a product to the wishlist,
   and verifies it persists after refresh."*
3. Claude calls `mabl plan_new_test` → `create_mabl_test_cloud` →
   `get_cloud_test_gen_status`.
4. Open the mabl workspace — the new test is there, already wired to
   the preview environment.

**Mabl value shown:** AI-native authoring, MCP integration,
shift-left QA investment.

---

## Act 2 — PR gate (6 min)

**Story:** "PR opens. Pipeline runs. If any mabl test fails, the PR is
blocked."

1. Create a branch + make a small change (e.g., rename a button).
2. Open a PR.
3. Jenkins/Actions trigger automatically.
4. **Watch the pipeline:** checkout → build → deploy preview →
   `mabl deployment` with labels `api-smoke` + `pr-gate`.
5. Open the mabl run link from the pipeline log — show the UI run in
   flight.
6. **Intentional break:** change the login button's text, remove its
   `data-testid`. Push. Show mabl auto-healing — test still passes
   because mabl re-anchored on the visible label.
7. **Intentional full break:** remove the button entirely. Pipeline
   fails. Show the `on failure` step → `mabl-analyze-last-failure.sh`
   output. Show the Claude triage comment (via mabl MCP `analyze_failure`).
8. Fix the PR → pipeline re-runs → green.

**Mabl value shown:** auto-healing under change, intelligent failure
attribution, PR quality gate.

---

## Act 3 — Main pipeline → production (5 min)

**Story:** "PR is approved and merged. The pipeline runs the full
regression and promotes to prod."

1. Merge the PR.
2. Jenkins main-branch pipeline triggers.
3. Stage 6: `mabl regression` with label `regression` — runs the full
   plan set against the just-deployed prod URL.
4. Stage 7: promotion happens (Vercel auto-deploys; for non-Vercel orgs
   this is where `helm upgrade` or similar runs, gated on stage 6).
5. Stage 8: `post-deploy smoke` — confirms the new commit is live via
   `/api/build-info`, then runs a small mabl plan against prod.

**Mabl value shown:** regression confidence, deploy gate, post-deploy
assurance.

---

## Act 4 — Continuous production monitoring (4 min)

**Story:** "Deploy landed. Now mabl watches production for you."

1. In mabl, show the **scheduled deployment** running the
   `post-deploy-smoke` label every 15 min against prod.
2. Run `./scripts/demo-toggle.sh flaky` — production now intermittently
   fails (25% of API calls stall, ~20% 503).
3. Wait for the next scheduled run (or trigger one manually).
4. Show mabl detecting flake, grouping the failures, and routing them
   to whatever incident channel is wired up (Slack, PagerDuty, etc).

**Mabl value shown:** synthetic monitoring, flake detection, incident
routing.

---

## Act 5 — Triage + fix (4 min)

**Story:** "mabl flagged an incident. Engineer opens Claude, triages,
and ships a fix."

1. In Claude Code, prompt: *"There's a failing mabl run against prod.
   Triage it and draft a fix PR."*
2. Claude calls `mabl get_latest_plan_runs` → `analyze_failure` →
   inspects the repo code → writes a PR with the fix.
3. PR opens → back to **Act 2** flow → merges → **Act 3** runs → prod
   fixed.
4. Run `./scripts/demo-toggle.sh normal` to reset.

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
