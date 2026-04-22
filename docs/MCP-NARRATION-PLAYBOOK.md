# MCP Narration Playbook — Claude-in-the-loop CI observability

Canonical rules for how Claude should narrate ticket-to-prod CI events
into Slack + Jira when a Slack webhook is not available (e.g., no
admin approval for incoming webhooks or Workflow Builder).

This playbook complements `scripts/ci-notify.sh`. When the secret
`SLACK_WEBHOOK_URL` is set, the script handles notifications
autonomously. When it's not set — and while the user prefers to keep
it that way — Claude reads the same CI state and posts the same
messages via the Slack MCP. **Every message below matches the format
the script would emit.**

## When this playbook applies

- Secret `SLACK_WEBHOOK_URL` is unset OR the user has explicitly asked
  Claude to narrate the demo in real time.
- Claude has access to Slack MCP (`slack_send_message`, `slack_read_channel`)
  and Jira MCP (`addCommentToJiraIssue`, `transitionJiraIssue`).

## Channel + thread convention

- **Channel:** `#vince-agentic-workflow-demos` (`C0A321B477Y`).
- **One thread per Jira ticket.** Kickoff message is posted at channel
  level (becomes the thread root); all subsequent narration for that
  ticket — CI gate transitions, mabl forwards, shipped announcement —
  posts as thread replies using `thread_ts`.
- The kickoff message should be the ONLY channel-level post per
  ticket from Claude. Everything else is threaded.

## Kickoff message (channel-level, once per ticket)

Posted when a new Jira ticket's work starts (user creates the ticket
and branch). Sets the thread root.

```
:hockey: *New work: <TICKET_KEY> — <short summary>*

:ticket: Jira: <link|TICKET_KEY>
:package: Project: *<project-name>*
:label: Labels: <labels list>

*What will happen, automated, observable here:*
1. PR opens → T1 pre-push newman on laptop
2. GHA runs: lint → unit → build → T1 newman (Preview) → mabl CSH-SMOKE-PR
3. Branch protection gates merge on 5 required checks
4. Merge → Vercel prod deploy → T1 newman (Prod) → mabl CSH-SMOKE-POSTDEPLOY
5. Live site verified

I'll post every gate transition in this thread. This thread is the audit trail.
```

**Record the returned `message_ts` as `thread_ts`** for all subsequent
posts on this ticket.

## Gate transition messages (thread replies)

Match `scripts/ci-notify.sh` format exactly so future autonomous
messages and current narration are indistinguishable in layout.

### Success — Stage 1 (code quality) passed

```
:white_check_mark: *Passed: Stage 1 · code quality* — <PR_URL|PR #N TICKET-XX: title>

by *<author>* on `<sha_short>` (branch `<branch>`)

:package: *Code changes:* <N> files, +<A>/-<D> lines
:test_tube: *Unit tests:* <P>/<T> passed
:bar_chart: *Coverage:* <X>% lines (gate 90% :white_check_mark:)

Lint ok, unit tests green, build succeeded. Ticket moving to *In Progress*.

:arrow_forward: *Next up:* T1 — newman smoke (Preview)

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run> · <JIRA_URL|Jira TICKET-XX>
```

### Success — T1 newman (Preview) passed

```
:white_check_mark: *Passed: T1 newman smoke (Preview)* — <PR_URL|PR #N TICKET-XX>

by *<author>* on `<sha>` (branch `<branch>`)

:zap: *Newman:* <REQ> requests, <PASS>/<TOTAL> assertions passed in <SEC>s

Preview API tests all green against the PR's Vercel URL.

:arrow_forward: *Next up:* mabl cloud — CSH-SMOKE-PR (Preview)

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run> · <JIRA_URL|Jira TICKET-XX> · <PREVIEW_URL|Preview site>
```

### Success — merge-ready (mabl cloud passed)

```
:white_check_mark: *Passed: Merge-ready* — <PR_URL|PR #N TICKET-XX>

All 5 required PR checks are green — merge button is live.
mabl Slack app posted the plan-run result (see thread-forwarded message above).

:arrow_forward: *Next up:* Merge allowed — branch protection unblocked.

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run> · <JIRA_URL|Jira TICKET-XX>
```

### Success — shipped to production

```
:white_check_mark: *Passed: Shipped to production* — <PR_URL|PR #N TICKET-XX>

:rocket: Change is live on <PROD_URL|cheap-shot-hockey.vercel.app> and verified
by mabl against real prod. Ticket transitioning to *Done*.

:arrow_forward: *Next up:* Live. Ticket moved to Done.

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run> · <JIRA_URL|Jira TICKET-XX> · <PROD_URL|Production>
```

### Failure at any gate

```
:rotating_light: *BLOCKED: <gate name>* — <PR_URL|PR #N TICKET-XX>

<metrics block showing the failure detail — e.g. 68/73 tests, coverage 87.2%, or 34/37 assertions>

<short actionable summary of what's broken and what to fix>

:arrow_forward: *Next up:* <what the human needs to do>

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run (see logs)> · <JIRA_URL|Jira TICKET-XX>
```

## Forwarding mabl plan posts into the thread

mabl's native Slack app posts plan-run results at channel level, not
in the ticket thread. To keep the audit trail consolidated:

1. After every mabl cloud gate (mabl-smoke, post-deploy-smoke)
   completes, use `slack_read_channel` to fetch the latest 2–3
   channel messages.
2. Identify mabl's post by author (`app_id` / bot name matches the
   mabl integration) OR by timestamp (fired just after the gate
   completed in GHA).
3. Construct a permalink:
   `https://<workspace>.slack.com/archives/<CHANNEL_ID>/p<ts_without_dot>`
4. Post a thread reply linking back to the channel message:
   ```
   :link: *mabl plan result in-channel* · <permalink|view mabl's post>
   Summary: <pass/fail, test count, duration — from the gate message>
   ```
5. This keeps the ticket thread self-contained while preserving
   mabl's native post (useful for anyone who navigates via the mabl
   app's own link back).

## Jira comments (runs in parallel with Slack)

Every Slack narration message should have a matching Jira comment
posted via `addCommentToJiraIssue`. Use the same structure but in
wiki-markup form:

```
*<gate name>* — *<OK|FAIL>*

*PR:* [#N title|PR_URL] (by author)
*Commit:* `<sha>` on branch `<branch>`
*Event:* pull_request / push

*Metrics:*
<flat list from the Slack metric block — remove mrkdwn markers>

*Traceability:*
- GitHub PR: <URL>
- GitHub Actions run: <URL>
- mabl plan run: <URL> (when applicable)
- Vercel Preview: <URL> (when applicable)
- Production: <URL> (when applicable)
```

## Jira status transitions

Apply automatically at these two moments:

| Event | Transition |
| --- | --- |
| Stage 1 (lint + unit + build) green on PR event | To Do → **In Progress** |
| post-deploy-smoke green on main push | In Progress → **Done** |

Use `getTransitionsForJiraIssue` to resolve the transition ID by name,
skip no-op if the ticket is already in that state.

## Detecting CI events from Claude's side

Without a webhook, Claude polls GHA status:

- `gh run list --branch <branch> --limit N` → find the active run
- `gh run view <run_id> --json jobs` → per-job status
- Monitor each job's `conclusion` transitioning from `null` → `success|failure|skipped`

The `Monitor` tool with a polling script is the reliable pattern —
each status-change line becomes a chat event, Claude can then compose
the right narration message per transition.

## Summary — what Claude owes the user at each stage

| Moment | Channel message | Thread message | Jira comment | Transition |
| --- | --- | --- | --- | --- |
| New ticket / branch | Kickoff (thread root) | — | "PR opened, T1 pre-push green" | — |
| Stage 1 green (first CI event) | — | Stage 1 passed | same | To Do → In Progress |
| T1 newman Preview green | — | T1 Preview passed | same | — |
| mabl-smoke success | — | Merge-ready + forward mabl post | same | — |
| mabl-smoke failure | — | BLOCKED + forward mabl post | same | — |
| Merge happens | — | Merged → deploying | same | — |
| T3 post-deploy success | — | Shipped to prod | same + acceptance-criteria tick-through | In Progress → Done |
| T3 post-deploy failure | — | Prod post-deploy FAILED | same | — |

That's the complete rhythm. Every demo follows this shape; consistent
shape is what makes the Slack channel clean.
