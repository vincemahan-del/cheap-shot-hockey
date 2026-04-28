# Fork guide — deploy this agentic SDLC on your own stack

Audience: an engineering team that wants to adapt this pattern to their
own product. Estimated time: **90 minutes** end-to-end if you have all
your accounts already (mabl, GitHub, Slack, Jira, Anthropic).

This guide turns a fresh fork of `cheap-shot-hockey` into a working
agentic SDLC for **your** application. The reference architecture
itself is in [`docs/REFERENCE-ARCHITECTURE.md`](REFERENCE-ARCHITECTURE.md);
this is the hands-on adaptation walkthrough.

> **Prerequisites:** GitHub Actions enabled, mabl trial or paid
> workspace, Atlassian (Jira) account with project create permission,
> Slack workspace where you can either (a) install a Slack app or
> (b) create a Workflow Builder workflow without admin help, and an
> Anthropic API key (optional — only required for the live recovery
> agent loop).

---

## Step 1 — Fork the repo

```bash
gh repo fork vincemahan-del/cheap-shot-hockey --clone --remote
cd cheap-shot-hockey
```

Or click "Fork" in the GitHub UI.

You're forking the **demo** repo as your starting point. You'll keep
the full SDLC scaffolding (workflows, scripts, subagents) and replace
the demo product code (the hockey store) with your own application
later.

For your first end-to-end smoke run, leave the demo code in place —
it's faster to verify the gates work against a known-good app, then
swap the app code afterward.

---

## Step 2 — Provision mabl

1. **Workspace.** mabl Settings → Workspace ID. Capture the UUID.
2. **Application.** Settings → Applications → "Add application". Name
   it whatever you like (e.g. *"My Storefront"*). Capture the UUID.
3. **Environments.** Create at least two:
   - **Preview** — points at your CI's per-PR deploy (Vercel preview
     URL pattern, Heroku review app, ephemeral cluster, etc.)
   - **Production** — your real prod URL.

   Capture both UUIDs.
4. **Credentials.** If your app has login, add demo creds for both
   envs. (cheap-shot-hockey uses `demo@cheapshot.test` /
   `demo1234` — replace with your own.)
5. **API token.** Settings → APIs → "Create API token". Capture it.
6. **Plans (split by environment — non-negotiable).** Create two:
   - **`<YOUR-PREFIX>-SMOKE-PR`** — Preview env only. Labels:
     `type-smk,exec-pr`. ~3-5 tests covering critical UI journeys.
     This gates the merge button on every PR.
   - **`<YOUR-PREFIX>-SMOKE-POSTDEPLOY`** — Prod env only. Labels:
     `type-smk,exec-postdeploy`. Verifies the live deploy.

   The "split by environment" matters — it keeps the gate signals
   clean. Don't unify them. (See `docs/REFERENCE-ARCHITECTURE.md` for
   the rationale.)

**Time:** ~20 min if mabl is fresh; ~5 min if you have an existing
workspace.

---

## Step 3 — Provision Jira

1. **Project.** Pick a project key (e.g. `XYZ`). The pattern uses the
   project key as the ticket prefix throughout (e.g. `XYZ-101/feature-name`
   for branches, `XYZ-101: ...` for commits).
2. **API token.** Atlassian account → Security → API tokens → Create.
   Capture it. Capture your account email too.
3. **Workflow.** Confirm your project's workflow has these transitions:
   - To Do → In Progress (auto-fired when Stage 1 greens on a PR)
   - In Progress → Done (auto-fired when post-deploy gate greens on main)

   The default Atlassian workflow has both. Custom workflows may need
   adjustment.

**Time:** ~10 min.

---

## Step 4 — Provision Slack

You have two posting paths to choose from. Pick one for v1; you can
switch later.

### Option A: Workflow Builder webhook (no admin needed)

1. In Slack: **Tools → Workflow Builder → Create**.
2. Trigger: **Webhook**.
3. Variable: `text` (string).
4. Action: **Send a message** to your demo channel, with content `{{text}}`.
5. Publish. Copy the webhook URL.

This works without workspace admin but limits you to plain mrkdwn
(no labeled links, restricted formatting). The demo's
`scripts/ci-notify.sh` uses this path by default.

### Option B: Slack app with `chat:write` (richer formatting)

1. **api.slack.com/apps** → Create New App → From scratch.
2. **OAuth & Permissions** → Bot Token Scopes (or User Token Scopes
   if installing personally) → add `chat:write`.
3. **Install to Workspace** (may require admin approval depending on
   workspace policy).
4. Copy the `xoxb-` (or `xoxp-`) token.

Bot token gives you `chat.postMessage` with full mrkdwn, labeled links
(`<URL|label>`), and threading. `ci-notify.sh` prefers this path when
`SLACK_BOT_TOKEN` is set.

### Channel ID

In Slack, click the channel name → "View channel details" → bottom of
modal → "Channel ID". Capture it.

**Time:** ~5 min for Option A; ~10-15 min for Option B (longer if
admin approval is needed).

---

## Step 5 — Add repo secrets

Replace the placeholder values below with your captures from Steps 2-4,
then run:

```bash
gh secret set MABL_API_TOKEN       --body "..." --repo OWNER/REPO
gh secret set MABL_WORKSPACE_ID    --body "..." --repo OWNER/REPO
gh secret set MABL_APPLICATION_ID  --body "..." --repo OWNER/REPO
gh secret set MABL_ENV_PREVIEW_ID  --body "..." --repo OWNER/REPO
gh secret set MABL_ENV_PROD_ID     --body "..." --repo OWNER/REPO
gh secret set SLACK_WEBHOOK_URL    --body "..." --repo OWNER/REPO
# (Option B only)
gh secret set SLACK_BOT_TOKEN      --body "xoxb-..." --repo OWNER/REPO

gh secret set JIRA_USER_EMAIL      --body "..." --repo OWNER/REPO
gh secret set JIRA_API_TOKEN       --body "..." --repo OWNER/REPO

# Optional — recovery agent fail-safes if missing
gh secret set ANTHROPIC_API_KEY    --body "sk-ant-..." --repo OWNER/REPO
```

Or use the GitHub UI: Settings → Secrets and variables → Actions →
New repository secret.

The full catalogue (with comments and example values) is in
[`config.env.example`](../config.env.example).

**Time:** ~5 min.

---

## Step 6 — Find-and-replace the hardcoded demo values

A handful of values are baked into source files (not env vars) and
need a one-time fork-time replacement. Search for the demo values
listed below and substitute yours:

| Demo value | Used in | Replace with |
| --- | --- | --- |
| `pXXgThbNi4HfQOpiZptHfw-w` (mabl workspace) | `scripts/ci-notify.sh` (line ~152, the `mabl_workspace_url`) | your workspace UUID |
| `C0A321B477Y` (Slack channel ID) | `.github/workflows/mabl-sdlc.yml` (`env.SLACK_CHANNEL_ID`) | your channel ID |
| `https://cheap-shot-hockey.vercel.app` (prod URL) | `.github/workflows/mabl-sdlc.yml` (`env.PRODUCTION_URL`), `scripts/demo-toggle.sh`, `scripts/ci-notify.sh` Slack mabl link | your prod URL |
| `https://mabl.atlassian.net` (Jira base URL) | `.github/workflows/mabl-sdlc.yml` (`env.JIRA_BASE_URL`) | your Atlassian URL |
| `TAMD-` (ticket prefix) | `scripts/ci-notify.sh` (regex `[A-Z][A-Z0-9]+-[0-9]+`) | already generic — no change needed |
| `CSH-SMOKE-PR` / `CSH-SMOKE-POSTDEPLOY` | `.github/workflows/mabl-sdlc.yml`, `docs/SDLC-DEMO.md` | your plan names |
| `cheap-shot-hockey` (repo name in URLs) | `docs/SDLC-DEMO.md` worked examples | your repo |
| `vincemahan-del` (GitHub owner) | `docs/SDLC-DEMO.md` worked examples | your owner |
| Demo creds `demo@cheapshot.test` | `src/lib/seed.ts`, `docs/SDLC-DEMO.md` | your demo creds |

A find-replace IDE pass typically takes ~5 min.

---

## Step 7 — Configure branch protection

In GitHub: Settings → Branches → Branch protection rules → Add rule
for `main`.

Required status checks (the 5-check gate that makes auto-merge wait
for everything green):

- `lint (eslint)`
- `unit tests + coverage`
- `build (next)`
- `T1 — newman smoke (Preview)`
- `mabl — <YOUR-PREFIX>-SMOKE-PR (Preview)`

Optional but recommended:

- `Claude — definition of done`
- `Analyze (javascript-typescript)` (CodeQL)
- `security (npm audit)` — once any baseline findings are triaged

Enable: **Allow auto-merge**, **Automatically delete head branches**.

```bash
gh repo edit OWNER/REPO --enable-auto-merge
gh api -X PATCH /repos/OWNER/REPO -f delete_branch_on_merge=true
```

**Time:** ~5 min.

---

## Step 8 — Verify with a smoke run

The fastest end-to-end smoke is a tiny doc-only PR:

```bash
git checkout -b XYZ-1/smoke-test main
echo "" >> README.md
git add README.md
git commit -m "XYZ-1: smoke-test fork-time setup"
git push -u origin XYZ-1/smoke-test
gh pr create --base main --head XYZ-1/smoke-test \
  --title "XYZ-1: smoke-test fork-time setup" \
  --body "Verifying the agentic SDLC pipeline post-fork."
gh pr merge <N> --auto --merge --delete-branch
```

Watch your demo Slack channel. You should see, within ~3 min:

1. `[XYZ-1] Passed: Stage 1 · code quality` (lint, unit, build green)
2. `[XYZ-1] Passed: T1 newman smoke (Preview)`
3. `[XYZ-1] Passed: Merge-ready` (mabl PR-gate green)
4. Auto-merge fires
5. `[XYZ-1] Passed: T1 newman smoke (Prod)`
6. `[XYZ-1] Passed: Shipped to production`

If any gate fails, the Slack post will say exactly what's broken with
links to the failing run, mabl plan, and Jira ticket.

If everything greens: **you're live**. The agentic SDLC is now your
SDLC.

---

## Step 9 (later) — Swap in your application

Once the gates work end-to-end against the demo app:

1. Replace `src/` with your application code.
2. Update `mabl/postman/csh-api-smoke.postman_collection.json` to
   exercise your API (or create a new one).
3. Re-author your mabl plans to test your real UI flows.
4. Drop the cheap-shot-hockey-specific demo middleware (`?demo=*` in
   `src/middleware.ts`) unless you want it for your own demos.
5. Update `CLAUDE.md` to describe your codebase + conventions.

The CI scaffolding, subagents, and notification plumbing don't need
to change — they're application-agnostic.

---

## Common issues

| Issue | Fix |
| --- | --- |
| Slack posts show italic where bold should be | You're using the MCP path (standard markdown) but the templates are Slack mrkdwn. See [`docs/MCP-NARRATION-PLAYBOOK.md`](MCP-NARRATION-PLAYBOOK.md) "Markdown dialect" section. |
| `mabl deployment` polling never resolves | Verify the plan name matches `MABL_PLAN_LABELS` exactly + the env UUID is right. `scripts/mabl-deployment.sh` has a 60s grace for "no plan match". |
| Jira transition doesn't fire | Ticket key extraction relies on the branch name format `<KEY>/short-slug` OR the commit message starting with `<KEY>:`. Check the run logs. |
| Recovery agent always emits page-human | `ANTHROPIC_API_KEY` not set, or the agent received malformed diagnostic context. Check the GHA `recovery-agent` job logs. |
| Coverage gate fails on first run | Adjust `coverage.thresholds` in `vitest.config.ts` to match your codebase reality, then tighten over time. |

---

## Going further

- **Pluggable notification transports** (Slack-bot / Slack-webhook /
  Teams / Jira-only / GitHub-comments) — track in a follow-up.
- **Failure-recovery agent action surface** — currently advisory only;
  v2 can extract custom MCP tools for autonomous revert PRs.
- **Plan-mode "AI proposes, human disposes"** — for high-blast-radius
  changes, the orchestrator can post a plan to Jira, wait on a
  transition for approval, then execute.

These are explicitly *out of scope for v1*. The minimum viable
reference architecture is what's documented above.
