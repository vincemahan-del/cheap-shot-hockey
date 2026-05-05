# mabl + Azure DevOps Pipelines — integration reference

A customer-facing reference for integrating mabl with Azure DevOps
Pipelines, covering the three friction points that come up most often:

1. Dynamic TOTP override from the pipeline (when UI plan-level config
   takes precedence)
2. Tests appearing "bound" to the environment they were created in
3. ADO Test Plans / Test Case traceability for mabl test executions

This doc is **SE / post-sales talk track** plus the reference scripts
under `scripts/ado-test-results-bridge.sh` and the reference pipeline
at `azure-pipelines.yml`. Lift any of it directly into a customer
response or proof-of-concept.

> **Verify-flag:** mabl product behavior shifts across releases and
> tiers. The patterns below are based on mabl's published REST API +
> common customer integration shapes, but always verify the specific
> behavior in the customer's workspace before committing to a design.

---

## The architectural takeaway (lead with this)

> **Drive everything from the API + variables. Treat the mabl UI as
> humans-only.** Customer pipelines hit friction when they fight the
> UI for control of plan-level config. The fix is almost always to
> move config off the plan (to env-level groups OR to runtime
> variables) so the pipeline owns the dynamic dimension and the UI
> just sets the static defaults.

Almost every pipeline-vs-UI conflict in mabl resolves to this rule.

---

## Q1 — Dynamic TOTP override from the pipeline

### Customer pain
> "We maintain two TOTP groups for different environments. Our pipeline
> selects the right one, but if a TOTP is configured in the mabl UI at
> the plan level, that takes precedence and our override is lost."

### Why this happens
TOTP credentials configured at the **plan level** are evaluated first
in mabl's runtime resolution order. Pipeline parameters can't override
a plan-level binding directly — that's by design (plan-level config is
intended to be authoritative).

### Recommended workarounds (in order of preference)

**Option A — Move TOTPs to environment-level groups (preferred):**
- Configure one TOTP group per environment (Preview, Staging, Prod, etc.)
- Remove the TOTP binding from the plan
- Pipeline selects the env at runtime → mabl resolves the matching
  TOTP automatically
- Best practice: env-level config scales to N environments without
  duplicating plans

> **Verify-flag:** confirm env-scoped TOTP groups are available on the
> customer's mabl tier before redesigning. Architecture matches mabl's
> environment-config model but specific feature availability can vary.

**Option B — Drive TOTP via mabl variables:**
- Define a workspace variable like `TOTP_GROUP_NAME`
- Test step references the variable to pick the matching secret
  (`mabl-secrets` lookup keyed off the variable value)
- Pipeline injects the variable at runtime via:
  - REST: `properties` field in the deployment-event POST payload
  - CLI: `mabl tests run --variable TOTP_GROUP_NAME=group_a`
- Works regardless of how TOTP groups are scoped

**Reference:** `azure-pipelines.yml` stage `MablPRGate` shows the
variable-injection pattern via `MABL_VARIABLES` env var.

---

## Q2 — Tests "bound" to a specific environment

### Customer pain
> "Each test appears to be tightly bound to the environment it was
> created in. Even though our pipeline passes the intended env at
> runtime, mabl executes the test in the env defined in the UI."

### Why this is half-myth
Plans have a **default environment** for UI editing and ad-hoc runs,
but **runtime execution environment IS overridable** from the
pipeline. If overrides aren't sticking, something specific is
intercepting them — not a fundamental product limit.

### Confirmed override paths

**REST API (recommended):**
```bash
curl -X POST -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "environment_id": "<env-uuid>",
    "application_id": "<app-uuid>",
    "plan_labels": ["pr-gate"]
  }' \
  https://api.mabl.com/events/deployment
```
The `environment_id` field overrides the plan's default for that run.
This is exactly what `scripts/mabl-deployment.sh` already does.

**CLI:**
```bash
mabl tests run --environment-id <env-uuid> --labels type-rt
```

> **Verify-flag:** confirm the exact CLI flag name in the customer's
> installed `mabl --version` via `mabl tests run --help` — REST API
> field names have been stable; CLI flags have occasionally renamed.

### Debug checklist when overrides aren't sticking

1. **Are you POSTing the deployment event directly, or via a wrapper
   that's hardcoding the env?** Check the wrapper.
2. **Is there a plan-level UI env pin?** Open the plan → Environment
   dropdown. If it's set to a specific env (not "Use deployment event
   environment"), that beats the API call. Switch to deployment-event
   mode.
3. **Verify what env actually executed:** mabl UI → Plan Runs → expand
   the run → confirm the `Environment` field. Compare to what the
   pipeline passed.
4. **For CLI runs:** `mabl tests run --environment-id` only works if
   the test is *not* already pinned to a specific env at the test
   level. Check the test's env config in the UI.

If the customer can share the exact REST/CLI invocation + expected vs.
actual env, the pin is usually findable in 5 minutes via mabl UI.

### Reference in this repo
The cheap-shot-hockey demo runs the same plans against two envs
(Preview for PRs, Prod for post-deploy) — see
`scripts/mabl-deployment.sh` and the `MABL_ENV_PREVIEW_ID` /
`MABL_ENV_PROD_ID` selection in `.github/workflows/mabl-sdlc.yml`.
The `azure-pipelines.yml` reference in this repo demonstrates the
exact same pattern in Azure DevOps syntax.

---

## Q3 — Azure DevOps Test Case association / traceability

### Customer pain
> "Microsoft documents how Selenium / NUnit / Playwright tests can be
> associated with ADO Test Plans Test Cases via code attributes. Can
> we get the same traceability for mabl tests run from Azure DevOps?"

### Honest answer
**mabl doesn't ship a native ADO Test Plans connector today.** mabl's
first-party result integrations focus on Jira + Xray. There is no
equivalent of the `[TestMethod]` / `[TestCase]` attribute pattern that
ADO recognizes natively for code-bound frameworks.

### The bridge pattern (this repo provides a reference)

The traceability the Microsoft doc describes is achievable via a
pipeline-side bridge that:

1. **Tag mabl tests with labels carrying the ADO Test Case ID.**
   Convention: a label of the form `ado-tc-1234` where `1234` is the
   ADO Test Case ID. Tag at test-creation time or via the mabl UI.

2. **After the deployment event completes**, poll mabl REST
   `/execution/result/event/<event_id>` for per-test results
   (status + labels).

3. **Bridge script creates an ADO Test Run + posts per-test results**
   via the ADO Test Plans REST API:
   - `POST /{org}/{project}/_apis/test/Runs?api-version=7.1`
     to create a run
   - `POST /{org}/{project}/_apis/test/Runs/{runId}/results?api-version=7.1`
     with per-test results, mapping `ado-tc-XXXX` labels → `testCase.id`
   - `PATCH /{org}/{project}/_apis/test/Runs/{runId}?api-version=7.1`
     to mark the run Completed

**Reference implementation:** `scripts/ado-test-results-bridge.sh`
(~200 lines, bash + curl + jq, no external deps).

### Adoption checklist for customers

- [ ] Tag mabl tests with `ado-tc-<id>` labels for any test that needs
      ADO traceability. Tests without the label are silently skipped
      by the bridge — not an error, they just don't get linked.
- [ ] Create an ADO Personal Access Token (PAT) with **Test Management
      (Read & Write)** scope. Org-scoped is fine for v1; project-scoped
      PATs are better for least-privilege.
- [ ] Add the PAT to your Azure DevOps Variable Group as `ADO_PAT`.
- [ ] Lock `ADO_API_VERSION=7.1` (or whatever you've tested against)
      so a future ADO REST API breaking change doesn't silently drift
      your traceability.
- [ ] (Optional) Set `ADO_TEST_PLAN_ID` to link the run to a specific
      ADO Test Plan. Otherwise the run is unattached.

### What the customer gets

- ADO Test Plans → Runs view shows each mabl run with per-test outcomes
- Test Cases are auto-updated with the latest run result (Passed /
  Failed / Aborted / etc.)
- Run URL in the bridge log: deep link to the ADO Test Run for sharing

### What the bridge does NOT do

- It does not create ADO Test Cases. Customer authors Test Cases in
  ADO and tags the matching mabl test with `ado-tc-<id>`. Bridge is
  read-side only on ADO.
- It does not bidirectionally sync. mabl is the source of truth for
  test execution; ADO Test Plans is the read-side dashboard.

---

## Q4 — Best practices + product-feedback worth filing

These three patterns come up often enough they're worth filing as
formal mabl feature requests to put on the product team's radar:

1. **Pipeline-takes-precedence option for plan-level TOTP config.** A
   plan-level setting like "allow pipeline override" would let
   customers keep UI-friendly defaults while supporting dynamic
   pipeline overrides without the variable-driven workaround.
2. **Native ADO Test Plans connector.** First-party equivalent of the
   bridge pattern — read mabl results, post to ADO Test Runs +
   Results, with per-test mapping configurable in the mabl UI (tag
   plus dropdown, no labels-as-DSL).
3. **Plan-level env binding mode visibility.** The "Environment"
   dropdown on a plan has subtle behavior — making "Use deployment
   event environment" the visible default, with a clear warning when
   a specific env is pinned, would prevent the Q2 confusion.

> SE recommendation: bundle these as a single product-feedback note
> with the customer's name on it; product weighs feature requests by
> customer demand signal.

---

## Demo-ability with this repo

The cheap-shot-hockey demo can demonstrate Q2 + Q3 live:

- **Q2 (env override):** the existing GHA pipeline already runs the
  same plans against Preview (PR-time) and Prod (post-deploy) by
  passing `environment_id` in the deployment event. Same pattern in
  the `azure-pipelines.yml` reference.
- **Q3 (ADO bridge):** the `scripts/ado-test-results-bridge.sh` is
  runnable standalone — point it at any mabl deployment event id and
  any ADO project with a matching tagged test, and it will create a
  Test Run + post results. ~5 min to demo.

Q1 (TOTP) is more workspace-specific to demo live; talk-track + the
recommended-pattern reference is usually sufficient.

---

## Files in this reference

| File | What it does |
|------|--------------|
| `scripts/mabl-deployment.sh` | POST mabl deployment event; poll for results. Existing CSH script — works unchanged in ADO. |
| `scripts/ado-test-results-bridge.sh` | NEW — bridges mabl results to ADO Test Plans. Reads `ado-tc-<id>` labels, creates Test Run, posts per-test results. |
| `azure-pipelines.yml` | NEW — reference Azure Pipelines translation of `.github/workflows/mabl-sdlc.yml`, demonstrating mabl deploy + ADO bridge stages. |
| `docs/ADO-INTEGRATION.md` | This doc. |
| `scripts/ci-notify.sh` | Slack + Jira lifecycle notifications — existing CSH script, vendor-agnostic, works unchanged in ADO. |
