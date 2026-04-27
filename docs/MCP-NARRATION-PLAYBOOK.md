# MCP Narration Playbook — Claude-in-the-loop CI observability

Canonical rules for how Claude should narrate ticket-to-prod CI events
into Slack + Jira. The autonomous CI path is `scripts/ci-notify.sh`
posting via Slack Workflow Builder webhook (`SLACK_WEBHOOK_URL`); the
manual path is Claude posting via Slack MCP. Both produce the same
messages so transcripts are indistinguishable.

**Posting model: every message goes to channel root, prefixed `[TAMD-XX]`.**
Webhook triggers don't support threading, so we don't use threads at
all — even from MCP. Per-ticket grouping is preserved by the
`[TAMD-XX]` prefix in every message body (`Cmd+F TAMD-XX` in Slack
gives the same audit view a thread would).

## When this playbook applies

- Any time a CI event fires (autonomous, via the webhook script) OR
  the user asks Claude to narrate a demo in real time (via Slack MCP).
- Claude has access to Slack MCP (`slack_send_message`,
  `slack_read_channel`) and Jira MCP (`addCommentToJiraIssue`,
  `transitionJiraIssue`).

## One-ticket-per-distinct-work (non-negotiable)

**Every distinct piece of work gets its own Jira ticket.** This
applies especially to follow-up bug fixes, polish passes, and
retroactive corrections. Reusing a prior ticket — even one that's
still in progress — muddies the Jira audit trail and the commit log.

Correct pattern for a follow-up bug in TAMD-83's output:
1. **Create a new ticket** — TAMD-84: "CI notification bugs in
   TAMD-83 output: broken link mrkdwn + missing kickoff links"
2. **Link it to the parent** in Jira via `createIssueLink` — type
   `Defect` (TAMD-84 was created by TAMD-83), or `Relates` for
   weaker associations
3. **Branch name:** `TAMD-84/link-format-rules` (NOT
   `TAMD-83/link-format-rules`)
4. **Commit message:** `TAMD-84: ...` (NOT `TAMD-83: ...`)
5. **Slack:** new kickoff in `#vince-agentic-workflow-demos` at
   channel root, prefixed `[TAMD-84]`
6. **PR title:** references TAMD-84, body links to TAMD-83 for context

The anti-pattern: noticing a bug in TAMD-83's Done output, opening a
branch `TAMD-83/...` because it's fresh in mind. The bug fix is
*separate work* — it just happens to be about a previous ticket.
Treat it as its own unit, or the audit trail lies.

## Channel posting convention (non-negotiable)

- **Channel:** `#vince-agentic-workflow-demos` (`C0A321B477Y`).
- **All messages post at channel root.** No `thread_ts`, ever.
- **`[TAMD-XX]` prefix is mandatory** as the very first text on every
  Slack message body — it's how readers `Cmd+F` to a ticket's full
  audit trail.
- **Checklist before every Slack post:**
  1. What ticket is this message about?
  2. Does the message body start with `[<that ticket key>]`?
  3. If no — fix the body before posting.

### Why no threading

Slack Workflow Builder webhooks (the no-admin-required posting path
this demo uses) don't support `thread_ts`. To keep autonomous CI posts
and MCP-driven narration visually identical, MCP posts also go to root
with the prefix. Trade-off accepted: per-ticket grouping happens via
search, and Jira retains the canonical per-ticket audit trail.

## Kickoff message (once per ticket)

Posted when a new Jira ticket's work starts (user creates the ticket
and branch).

```
:hockey: *[TICKET_KEY] New work — <short summary>*

:ticket: Jira: <JIRA_URL|TICKET_KEY>
:package: Project: *<project-name>*
:label: Labels: <labels list>

*What will happen, automated, observable here:*
1. PR opens → T1 pre-push newman on laptop
2. GHA runs: lint → unit → build → T1 newman (Preview) → mabl CSH-SMOKE-PR
3. Branch protection gates merge on 5 required checks
4. Merge → Vercel prod deploy → T1 newman (Prod) → mabl CSH-SMOKE-POSTDEPLOY
5. Live site verified

Every gate transition for this ticket will post here, prefixed `[TICKET_KEY]`.

:link: <PR_URL|PR #N> · <ACTIONS_URL|GitHub Actions> · <JIRA_URL|Jira TICKET_KEY> · <PROD_URL|Production>
```

Use **always-available** URLs in the kickoff link row:
- `PR_URL` — from the gh pr create response
- `ACTIONS_URL` — `https://github.com/<repo>/actions?query=branch:<branch>` (valid the moment the workflow queues)
- `JIRA_URL` — `https://mabl.atlassian.net/browse/<TICKET_KEY>`
- `PROD_URL` — `https://cheap-shot-hockey.vercel.app` (constant)

Don't include Preview / GHA-run / mabl-plan URLs at kickoff — those
don't exist yet. Add them in subsequent messages as they become
available.

## Link formatting — non-negotiable

**Every link label in a `:link:` row MUST be wrapped in Slack
mrkdwn** `<URL|Label>` syntax. A bare label is a bug.

Correct:
```
:link: <https://github.com/.../pull/9|PR #9> · <https://mabl.atlassian.net/browse/TAMD-83|Jira TAMD-83>
```

WRONG (happens if a URL is missing from env):
```
:link: PR #9 · Preview site · Jira TAMD-83
```

If a URL isn't available for a label at message-compose time, **drop
the label entirely** rather than leaving a bare-text pseudo-link.
Silence on an unavailable link is better than fake link text.

## Gate transition messages (channel-root, prefixed `[TICKET-XX]`)

Match `scripts/ci-notify.sh` format exactly so autonomous webhook
messages and MCP-driven narration are indistinguishable.

### Success — Stage 1 (code quality) passed

```
:white_check_mark: *[TICKET-XX] Passed: Stage 1 · code quality* — <PR_URL|PR #N: title>

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
:white_check_mark: *[TICKET-XX] Passed: T1 newman smoke (Preview)* — <PR_URL|PR #N>

by *<author>* on `<sha>` (branch `<branch>`)

:zap: *Newman:* <REQ> requests, <PASS>/<TOTAL> assertions passed in <SEC>s

Preview API tests all green against the PR's Vercel URL.

:arrow_forward: *Next up:* mabl cloud — CSH-SMOKE-PR (Preview)

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run> · <JIRA_URL|Jira TICKET-XX> · <PREVIEW_URL|Preview site>
```

### Success — merge-ready (mabl cloud passed)

```
:white_check_mark: *[TICKET-XX] Passed: Merge-ready* — <PR_URL|PR #N>

All 5 required PR checks are green — merge button is live.
mabl's Slack app posted the plan-run result separately in this channel.

:arrow_forward: *Next up:* Merge allowed — branch protection unblocked.

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run> · <JIRA_URL|Jira TICKET-XX>
```

### Success — shipped to production

```
:white_check_mark: *[TICKET-XX] Passed: Shipped to production* — <PR_URL|PR #N>

:rocket: Change is live on <PROD_URL|cheap-shot-hockey.vercel.app> and verified
by mabl against real prod. Ticket transitioning to *Done*.

:arrow_forward: *Next up:* Live. Ticket moved to Done.

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run> · <JIRA_URL|Jira TICKET-XX> · <PROD_URL|Production>
```

### Failure at any gate

```
:rotating_light: *[TICKET-XX] BLOCKED: <gate name>* — <PR_URL|PR #N>

<metrics block showing the failure detail — e.g. 68/73 tests, coverage 87.2%, or 34/37 assertions>

<short actionable summary of what's broken and what to fix>

:arrow_forward: *Next up:* <what the human needs to do>

:link: <PR_URL|PR #N> · <RUN_URL|GitHub Actions run (see logs)> · <JIRA_URL|Jira TICKET-XX>
```

## mabl's native Slack posts

mabl's own Slack app posts plan-run results at channel root with rich
blocks (screenshots, assertion details, plan-run links). Those posts
sit alongside our `[TICKET-XX]`-prefixed gate messages — same channel,
no extra forwarding needed. Readers `Cmd+F`-ing a ticket key won't
match the mabl post directly, but the timestamps line up and our
"Merge-ready" / "Shipped to production" message references mabl's
adjacent post explicitly.

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

## Auto-merge (default for every PR)

The demo flow is *fully automated* unless something fails — no human
click required to merge a green PR. The pattern:

1. **Repo-level:** "Allow auto-merge" + "Automatically delete head
   branches" are on (configured via `gh repo edit --enable-auto-merge`
   and `gh api -X PATCH ... -f delete_branch_on_merge=true`).
2. **Per-PR:** Claude (or whoever opens the PR) immediately arms
   auto-merge with:
   ```bash
   gh pr merge <N> --auto --merge --delete-branch
   ```
3. **GitHub waits** for every required status check to pass (branch
   protection = the 5 required checks). When they all go green, the PR
   auto-merges with a merge commit, branch auto-deletes, main-push CI
   fires, T3 chain runs.
4. **If any check fails**, the PR sits blocked. No auto-merge, no
   prod deploy. Human (or Claude) investigates, fixes, pushes — the
   auto-merge remains armed and fires the moment the next CI goes
   green.

**The only manual step in the happy path is the initial PR creation.**
Everything after that is event-driven: CI green → merge → prod deploy
→ post-deploy smoke → Done transition.

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

## Summary — what's owed at each stage

Every Slack message is at channel root, prefixed `[TICKET-XX]`.

| Moment | Slack post | Jira comment | Transition |
| --- | --- | --- | --- |
| New ticket / branch | Kickoff | "PR opened, T1 pre-push green" | — |
| Stage 1 green (first CI event) | Stage 1 passed | same | To Do → In Progress |
| T1 newman Preview green | T1 Preview passed | same | — |
| mabl-smoke success | Merge-ready | same | — |
| mabl-smoke failure | BLOCKED | same | — |
| Merge happens | Merged → deploying | same | — |
| T3 post-deploy success | Shipped to prod | same + acceptance-criteria tick-through | In Progress → Done |
| T3 post-deploy failure | Prod post-deploy FAILED | same | — |

That's the complete rhythm. Every demo follows this shape; consistent
shape + the `[TICKET-XX]` prefix is what makes the channel clean.
