# Claude Code subagents

Custom Claude Code subagents shipped in `.claude/agents/`. Each is a
markdown file with frontmatter (name, description, tools) plus a
system prompt body. Available via the `Agent` tool — Claude can
delegate to them rather than re-prompting from scratch.

## Available agents

### `demo-orchestrator`

**When to use:** the user wants to ship a small change end-to-end
through the agentic ticket-to-prod pipeline. Drives the full Jira →
branch → PR → CI → auto-merge → prod flow autonomously, narrating in
Slack and managing Jira lifecycle.

**Examples:**
- "Ship a hero copy update from 70% to 85% off"
- "Add a category sale badge to the catalog page"
- "Fix the cart line-item alignment for mobile"

**What it knows:**
- The full MCP narration playbook (one ticket per work, one thread
  per ticket, message templates per gate)
- How to drive `gh pr create` + `gh pr merge --auto`
- How to forward mabl native Slack posts into the ticket thread
- How to verify live prod after T3 completes

**Tools available:** Bash, Read, Edit, Write, Grep, Glob, Jira MCP,
Slack MCP.

### `pr-reviewer`

**When to use:** review a PR against project conventions before merge.
Outputs a structured findings report (passes / suggestions /
blockers) that you can post as a PR review comment.

**Examples:**
- "Review PR #18 against the playbook"
- "Audit the test changes on this branch — any marketing-copy
  assertions?"
- "Check if this PR's coverage is sufficient"

**What it checks:**
- Ticket hygiene (branch name, commit format, parent-link if
  follow-up)
- Coverage gate (90% lines, 85% branches)
- Tiered assertion policy (no marketing copy / nav category lists /
  dynamic-ID equality)
- Code change scope (one ticket, one logical change)
- CI alignment (workflow + branch protection check names match)
- Documentation drift

**Tools available:** Bash, Read, Grep, Glob, Jira MCP. **Read-only
tools — does not push, merge, or modify the PR.**

### `mabl-test-author`

**When to use:** design a new mabl test for a feature, either as a
Postman collection (API layer) or via mabl MCP (UI layer). Adheres
strictly to the tiered assertion policy.

**Examples:**
- "Design an API test for the new wishlist endpoints"
- "Draft a UI test for the cart quantity update flow"
- "Add an API smoke for the new health-check endpoint"

**What it produces:**
- Postman v2.1 JSON collection in `mabl/postman/<slug>.postman_collection.json`,
  OR
- mabl plan + cloud-generated test via MCP, with governance labels
  applied

**Tools available:** Read, Write, Edit, Bash, mabl MCP, file pattern
tools. Does not write app code.

## How to invoke a subagent

In Claude Code, use the `Agent` tool with `subagent_type` set to the
agent name:

```
Agent({
  description: "Ship hero copy update",
  subagent_type: "demo-orchestrator",
  prompt: "Update the hero banner from 'Up to 85% off' to 'Up to 90% off'. New ticket, full ticket-to-prod flow."
})
```

The agent runs in its own session with access to its tool set. Its
final response is returned to the parent — that's where you'll see
the summary of what shipped.

## Why subagents (vs. just prompting Claude directly)

Three reasons:

1. **Codified rules** — the agent's system prompt encodes the
   playbook. Future sessions don't have to re-learn the rules every
   time. The `demo-orchestrator` agent will never accidentally reuse
   a Done ticket because the rule is baked in.

2. **Tool scoping** — subagents only get the tools they need. The
   `pr-reviewer` is read-only; it can't accidentally push or merge.

3. **Reusability across sessions** — your personal `~/.claude/agents/`
   has session-scoped agents; the repo-level `.claude/agents/`
   ships with the project, so any contributor (or any Claude session
   in the repo) gets the same orchestration patterns.

## Updating an agent

Edit the markdown file. The next time the agent is invoked, the new
system prompt applies. Treat agent updates like any other code change
— ship via Jira ticket + PR.

## Reference

- `.claude/agents/demo-orchestrator.md`
- `.claude/agents/pr-reviewer.md`
- `.claude/agents/mabl-test-author.md`
- `docs/MCP-NARRATION-PLAYBOOK.md` — what the orchestrator implements
- `docs/MABL-AI-ASSERTION-PROMPT.md` — what the test-author follows
- Claude Code docs on subagents: https://docs.claude.com/en/docs/claude-code/sub-agents
