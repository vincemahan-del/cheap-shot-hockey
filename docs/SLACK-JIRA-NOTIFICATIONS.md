# Slack + Jira notifications from CI

The mabl SDLC gate workflow posts a Slack message and Jira comment at
every gate transition. Gives non-technical stakeholders a live view
of ticket-to-production progress.

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

## Example — what a successful T3 notification looks like

Slack post in `#vince-agentic-workflow-demos`:

```
✅ T3 post-deploy shipped passed
repo: `vincemahan-del/cheap-shot-hockey` · branch: `TAMD-82/hero-copy-70` · commit: `abc1234`
jira: <https://mabl.atlassian.net/browse/TAMD-82|TAMD-82>
pr: <https://github.com/.../pull/7|#7>
workflow: <https://github.com/.../actions/runs/12345|run 12345>
🚀 Live on <https://cheap-shot-hockey.vercel.app|cheap-shot-hockey.vercel.app> — commit verified in prod.
```

Jira comment on TAMD-82:

```
*T3 post-deploy shipped* passed

| Field         | Value                         |
| ---           | ---                           |
| repo          | vincemahan-del/cheap-shot-hockey |
| branch        | TAMD-82/hero-copy-70          |
| commit        | abc1234                       |
| pr            | [#7|https://github.com/...]   |
| workflow run  | [link|https://github.com/...] |

🚀 Live on https://cheap-shot-hockey.vercel.app — commit verified in prod.
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| No Slack messages at all | `SLACK_WEBHOOK_URL` secret not set, or webhook revoked | Regenerate webhook, update secret |
| Slack works but no Jira comments | Branch name has no ticket key prefix | Rename branch or start it with `PROJ-###/...` |
| Jira 401 errors in workflow logs | Token expired or wrong email | Regenerate token, re-set secret |
| Jira 404 errors | Ticket key doesn't exist or user can't see it | Verify ticket visibility |
| Workflow fails because of notify step | Should never happen — script is wrapped with `|| echo …` | Open an issue with the failure log |

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
