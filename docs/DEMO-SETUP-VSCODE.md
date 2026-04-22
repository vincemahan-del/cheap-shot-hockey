# VS Code as the demo cockpit

Setup + layout for running the Cheap Shot Hockey ticket-to-prod demo
from VS Code. VS Code is the **stage** — one window where the
audience watches Claude edit code, the terminal stream CI output, and
the GitHub/Jira sidebars update live.

## One-time setup

### 1. Install the extensions

They're already listed in `.vscode/extensions.json` — opening this
repo in VS Code triggers an "install recommended" prompt. Or install
them via CLI:

```bash
code --install-extension anthropic.claude-code
code --install-extension github.vscode-pull-request-github
code --install-extension atlassian.atlascode
code --install-extension eamodio.gitlens
code --install-extension github.vscode-github-actions
code --install-extension humao.rest-client
```

### 2. Authenticate each

| Extension | Auth method |
| --- | --- |
| **Claude Code** | Already authed via `CLAUDE_CODE_OAUTH_TOKEN` GH secret or `claude setup-token` on your laptop |
| **GitHub Pull Requests** | Uses `gh auth` — should carry over if you've run `gh` before |
| **Atlascode (Jira)** | Command palette → `Atlassian: Open Settings` → **Authenticate** → `mabl.atlassian.net` |
| **GitLens** | Free tier works; no auth |
| **GitHub Actions** | Uses `gh auth` |
| **REST Client** | No auth |

### 3. Run the pre-flight

```bash
npm run demo:preflight   # or: bash scripts/demo-preflight.sh
# Or: Cmd+Shift+P → "Tasks: Run Task" → "demo: pre-flight check"
```

Fails loud if anything's missing (dev server, secrets, branch
protection, live prod reachability). Fix before starting.

## Demo layout

### Single-monitor layout (laptop only)

```
┌─────────────────────────────────┬──────────────────┐
│                                 │                  │
│  Primary editor                 │  Claude Code     │
│  (src/app/page.tsx during demo) │  sidebar         │
│                                 │  (chat + diffs)  │
│                                 │                  │
├─────────────────────────────────┴──────────────────┤
│                                                    │
│  Terminal (split panes):                           │
│   [1] npm run dev  (kept running)                  │
│   [2] git push / gh pr / preflight                 │
│                                                    │
└────────────────────────────────────────────────────┘
```

Audience: keep Slack (`#vince-agentic-workflow-demos`) and one Jira
tab visible as Cmd+Tab targets.

### Two-monitor layout (ideal)

- **Monitor 1 (VS Code):** editor + Claude sidebar + terminal
- **Monitor 2 (browser tabs):**
  1. `github.com/vincemahan-del/cheap-shot-hockey/pulls` (PR list)
  2. `mablhq.slack.com/archives/C0A321B477Y` (Slack channel)
  3. `mabl.atlassian.net/projects/TAMD` (Jira)
  4. `app.mabl.com/workspaces/pXXgThbNi4HfQOpiZptHfw-w` (mabl)
  5. `cheap-shot-hockey.vercel.app` (live site)

## Demo tasks (one-click via VS Code)

**Cmd+Shift+P → "Tasks: Run Task"** surfaces these:

| Task | What it does |
| --- | --- |
| `demo: pre-flight check` | Verifies dev server, secrets, branch protection, prod reachable |
| `demo: start dev server` | `npm run dev` in a dedicated panel |
| `demo: T1 local smoke (newman)` | Runs the newman Postman collection |
| `demo: open current PR in browser` | `gh pr view --web` |
| `demo: watch PR checks (live)` | `gh pr checks --watch` — tails status in a pane |
| `demo: arm auto-merge on current PR` | `gh pr merge --auto --merge --delete-branch` |
| `demo: open mabl workspace` | Opens `app.mabl.com` |
| `demo: open live prod site` | Opens `cheap-shot-hockey.vercel.app` |
| `demo: open Slack channel` | Opens `#vince-agentic-workflow-demos` |

## What stays in the CLI (intentionally)

These land *better* as terminal output than extension-driven UX
because seeing the actual command run is part of the story:

- `git push` — the T1 pre-push hook output appears inline
- `gh pr create` — demonstrates the agentic-CLI pattern
- `gh pr merge --auto` — the "one command arms auto-merge" demo moment

You could bind these to tasks for speed, but running the raw commands
in front of the audience reads as "this is real, not a demo script."

## What doesn't belong in VS Code

### Slack
VS Code Slack extensions are poor — the message rendering doesn't
match native Slack, threads are awkward, and the notification flow
breaks. Keep Slack in a browser tab (or the native Mac app). The rich
message formatting (emoji, threads, block kit) is load-bearing for
the "channel tells the story" narrative.

### mabl dashboard
No good VS Code integration for mabl. Browser tab to
`app.mabl.com/workspaces/pXXgThbNi4HfQOpiZptHfw-w` is the right
surface.

### Vercel deploy status
Vercel has a VS Code extension, but the PR check from GitHub already
shows Vercel deploy status inline. The extension is redundant.

## Demo-day script (5 minutes)

### 0. Pre-flight (1 min)

```bash
bash scripts/demo-preflight.sh
# Should print: Pre-flight OK. Ready to demo.
```

### 1. Create Jira ticket (30 sec)

Via the Atlascode extension sidebar → **Create Issue** → Project TAMD
→ Summary: *e.g.* "Hero banner copy update" → Create. Note the key
(TAMD-XX).

### 2. Claude makes the change (1 min)

In the Claude Code sidebar:
> "Update the hero banner to 'Slapshot Special · Up to 75% off' on branch TAMD-XX/hero-copy-75"

Watch Claude: create branch, edit `src/app/page.tsx`, commit, push.
Pre-push T1 newman fires in the terminal. Audience sees 37 assertions
pass in ~300ms.

### 3. Claude opens the PR + arms auto-merge (30 sec)

> "Open a PR referencing TAMD-XX and arm auto-merge"

`gh pr create` + `gh pr merge --auto` in the terminal.

### 4. Watch the gates (2 min)

In the GitHub PR sidebar (or `gh pr checks --watch` in terminal):

- lint (eslint) ✓
- unit tests + coverage ✓ — show the coverage line (97.97% vs 90% gate)
- build (next) ✓
- T1 — newman smoke (Preview) ✓
- mabl — CSH-SMOKE-PR (Preview) ✓ — flip to Slack: mabl's native post appears, Claude forwards into the ticket thread
- **Auto-merge fires** — branch auto-deletes, main advances

### 5. T3 chain fires automatically (1 min)

Main-push CI → T1 newman (Prod) → CSH-SMOKE-POSTDEPLOY → mabl posts
"Plan passed" in Slack → Claude narrates "🚀 Shipped" in the ticket
thread → Jira ticket auto-transitions to **Done**.

### 6. Verify live (15 sec)

Refresh `cheap-shot-hockey.vercel.app` — the new copy is live.

## End-of-demo cleanup

```bash
# (Optional) clear out demo branches + tickets
git fetch --prune
```

Auto-merge deletes merged branches automatically. Jira tickets stay
in Done as the audit trail.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Claude Code extension says "not authenticated" | `claude setup-token` in terminal |
| Atlascode shows 0 projects | Complete OAuth flow; re-auth via `Atlassian: Open Settings` |
| `gh pr checks --watch` hangs forever | Ctrl+C, then `gh pr checks` (no `--watch`) |
| Pre-push hook skipped | `.git/hooks/pre-push` not executable — run `./scripts/install-git-hooks.sh` |
| Auto-merge doesn't fire after green | Check `gh pr view <N> --json autoMergeRequest` — if empty, re-arm with `gh pr merge <N> --auto --merge --delete-branch` |

## References

- `.vscode/extensions.json` — the recommended extensions
- `.vscode/tasks.json` — one-click demo tasks
- `.vscode/settings.json` — workspace settings (title bar, file tree, etc.)
- `scripts/demo-preflight.sh` — the 20-second sanity check
- `docs/MCP-NARRATION-PLAYBOOK.md` — what Claude posts in Slack + Jira at each gate
- `docs/SLACK-JIRA-NOTIFICATIONS.md` — `ci-notify.sh` message format
- `docs/LOCAL-GATE.md` — T1 newman gate details
