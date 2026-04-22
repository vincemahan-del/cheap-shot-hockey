# Slack + Jira notifications from CI

The mabl SDLC gate workflow posts a clean, human-readable Slack
message and a structured Jira comment at every gate transition. Gives
non-technical stakeholders a live view of ticket-to-production
progress — and gives engineers the links they need to triage fast.

Alongside this, mabl's **native Slack app** posts plan-run results
directly with screenshots and assertion details. Our `ci-notify.sh`
and mabl's Slack app complement each other — we handle the gate
decision + ticket lifecycle, mabl handles the test-run detail.

## What gets notified

Each gate fires two possible notifications: success OR failure.

| Gate | On success | On failure |
| --- | --- | --- |
| lint | — (silent) | 🚨 lint failed |
| unit | — | 🚨 unit tests failed |
| build | ✅ Stage 1 passed (PR only) | 🚨 build failed |
| T1 newman (Preview) | ✅ T1 Preview green + preview URL | 🚨 T1 Preview failed |
| T1 newman (Prod) | ✅ T1 Prod green, commit verified | 🚨 T1 Prod failed |
| mabl CSH-SMOKE-PR (Preview) | ✅ all 5 required checks green, merge unblocked | 🚨 merge blocked |
| mabl CSH-SMOKE-POSTDEPLOY (Prod) | 🚀 shipped to prod | 🚨 prod post-deploy failed |

Notifications are best-effort: if the Slack/Jira APIs are flaky, the
gate itself still reports its real status to GitHub (notifications
never mask a real failure).

## Where they go

- **Slack:** `#vince-agentic-workflow-demos` (channel `C0A321B477Y`), via an
  Incoming Webhook URL configured in GitHub secrets as
  `SLACK_WEBHOOK_URL`.
- **Jira:** comment on the ticket referenced in the branch name. Any
  branch whose name *starts* with a ticket key (`TAMD-82/hero-copy`,
  `MABL-123/fix-whatever`) gets Jira comments. Branches without a
  ticket key get Slack-only notifications.

## Setup (one-time, per repo)

Three GitHub repository secrets. Add under **Settings → Secrets and
variables → Actions**.

### 1. `SLACK_WEBHOOK_URL`

Create an incoming webhook targeting `#vince-agentic-workflow-demos`:

1. https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name: `mabl-sdlc-gate-notifications` · Workspace: your mabl workspace
3. Left nav → **Incoming Webhooks** → toggle ON
4. Click **Add New Webhook to Workspace**
5. Pick channel `#vince-agentic-workflow-demos` → **Allow**
6. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)
7. Paste as repo secret `SLACK_WEBHOOK_URL`

### 2. `JIRA_USER_EMAIL` + `JIRA_API_TOKEN`

Generate an Atlassian API token tied to your user:

1. https://id.atlassian.com/manage-profile/security/api-tokens
2. **Create API token** → label `github-ci-cheap-shot-hockey` → **Create**
3. Copy the token (one-time display)
4. Repo secret `JIRA_USER_EMAIL` = your Atlassian account email
5. Repo secret `JIRA_API_TOKEN` = the token you just copied

Test it:

```bash
curl -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  https://mabl.atlassian.net/rest/api/2/myself | jq .displayName
```

Should return your name. Any `401` means the email or token is wrong.

## How the script works

`scripts/ci-notify.sh` is called from every GHA gate job's
success/failure step:

```yaml
- name: notify (success)
  if: success()
  run: bash scripts/ci-notify.sh ok "T2 mabl (Preview)" "extra markdown"
- name: notify (failure)
  if: failure()
  run: bash scripts/ci-notify.sh fail "T2 mabl (Preview)" "extra"
```

It reads:
- `SLACK_WEBHOOK_URL` → if set, POSTs the message to Slack
- `JIRA_USER_EMAIL`, `JIRA_API_TOKEN` → if set *and* branch name
  contains a ticket key regex (`[A-Z][A-Z0-9]+-[0-9]+`), posts a Jira
  comment via REST API v2

All curl calls are wrapped in `|| echo "... failed (non-fatal)"` so a
notification outage never breaks a gate.

## Branch naming convention (for Jira linking)

Prefix branches with the Jira ticket key:

- ✅ `TAMD-82/hero-copy-70-percent` → Jira comments appear on TAMD-82
- ✅ `MABL-501-fix-checkout-tax` → comments on MABL-501
- ❌ `demo/hero-copy-70` → no Jira linking (no ticket key matches)

The first `[A-Z]+-[0-9]+` substring wins, so slashes, hyphens, etc.
around the key are fine.

## Example — what messages look like (new format)

### Stage-1 passed (PR #8)

Slack post:

```
✅ Passed: Stage 1 · code quality — PR #8 TAMD-83 …

by vincemahan on `a672f8a` (branch `TAMD-83/richer-ci-notifications`)

📦 Code changes: 3 files, +68/-5 lines
🧪 Unit tests: 73/73 passed
📊 Coverage: 97.97% lines (gate 90% ✅)

Lint ok, unit tests green, build succeeded. Ticket moving to **In Progress**.

▶ Next up: T1 — newman smoke (Preview)

🔗 PR #8 · GitHub Actions run · Jira TAMD-83 · Jenkins job
```

### T1 newman passed

```
✅ Passed: T1 newman smoke (Preview) — PR #8 TAMD-83 …

by vincemahan on `a672f8a` (branch `TAMD-83/richer-ci-notifications`)

⚡ Newman: 11 requests, 37/37 assertions passed in 0.33s

Preview API tests all green against the PR's Vercel URL.

▶ Next up: mabl cloud — CSH-SMOKE-PR (Preview)

🔗 PR #8 · GitHub Actions run · Jira TAMD-83 · Preview site
```

### Merge-ready (mabl cloud green)

```
✅ Passed: Merge-ready — PR #8 TAMD-83 …

All 5 required PR checks are green — merge button is live.
mabl Slack app posted the plan-run result separately with
screenshots + assertion details.

▶ Next up: Merge allowed — branch protection unblocked. Merging
   triggers Prod deploy + T3.

🔗 PR #8 · GitHub Actions run · Jira TAMD-83 · Preview site
```

### Shipped to prod

```
✅ Passed: Shipped to production — PR #8 TAMD-83 …

🚀 Change is live on cheap-shot-hockey.vercel.app and verified by
   mabl against real prod (see mabl's Slack post above for per-test
   detail). Ticket transitioning to *Done*.

▶ Next up: Live. Ticket moved to Done.

🔗 PR #8 · GitHub Actions run · Jira TAMD-83 · Production
```

### Failure (coverage drop → unit job fails → everything skips)

```
🚨 BLOCKED: Unit tests + coverage — PR #9 …

🧪 Unit tests: 68/73 passed, 5 failed ❌
📊 Coverage: 87.2% lines (gate 90% ❌)

Fix failing tests or raise coverage before merge can be unblocked.

▶ Next up: fix unit tests before re-running CI

🔗 PR #9 · GitHub Actions run · Jira TAMD-xx
```

The Jira comment mirrors the Slack format with the same metrics,
stripped of Slack-specific mrkdwn.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| No Slack messages at all | `SLACK_WEBHOOK_URL` secret not set, or webhook revoked | Regenerate webhook, update secret |
| Slack works but no Jira comments | Branch name has no ticket key prefix | Rename branch or start it with `PROJ-###/...` |
| Jira 401 errors in workflow logs | Token expired or wrong email | Regenerate token, re-set secret |
| Jira 404 errors | Ticket key doesn't exist or user can't see it | Verify ticket visibility |
| Workflow fails because of notify step | Should never happen — script is wrapped with `|| echo …` | Open an issue with the failure log |

## Mabl native Slack app

In addition to `ci-notify.sh`, mabl's **official Slack app** posts
plan-run results directly with native mabl-branded formatting,
screenshots, and links into `app.mabl.com`. Our notifier handles the
*gate decision + ticket lifecycle*; mabl's app handles the *test-run
detail*.

### Setup (one-time, admin may be required in some workspaces)

1. In mabl UI → **Settings** → **Integrations** → **Slack** →
   **Install**
2. Slack prompts for channel permission → pick
   `#vince-agentic-workflow-demos`
3. In mabl → Integrations → Slack → configure which events to post
   (plan passed / plan failed / test failure are the usual picks)

Once configured, every cloud plan run (PR gate, post-deploy)
automatically posts to Slack with:

- Plan name
- Environment (Preview / Production)
- Pass/fail count
- Duration
- Direct link to the plan run in mabl
- Screenshots on failure (for browser tests)

### Why the two systems co-exist

| Concern | Handled by |
| --- | --- |
| Lint/unit/build + T1 newman results | `ci-notify.sh` (we own the tooling) |
| "Stage 1 passed — code quality green" | `ci-notify.sh` |
| Mabl plan runs (cloud) | mabl native Slack app |
| Jira ticket lifecycle (comment + transition) | `ci-notify.sh` |
| Merge-ready / merge-blocked decision summary | `ci-notify.sh` |
| Shipped-to-prod + Done transition | `ci-notify.sh` |

The result: **one coherent Slack story per ticket**, with mabl's
technical detail inline and our summary messages tying it together.

## Extending

To notify at more/fewer points:

- **More notifications:** add `bash scripts/ci-notify.sh ...` steps in
  any job. Works in any GHA job, any event trigger.
- **Fewer notifications:** delete the `notify (success)` or
  `notify (failure)` step from the job you want silent.
- **Different Slack channel:** add a second webhook URL as a new
  secret and pass `SLACK_WEBHOOK_URL=$OTHER_WEBHOOK` before the call.
- **Different Jira project:** the script auto-detects the ticket key
  from the branch — works for any project the token can reach.
