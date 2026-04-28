#!/usr/bin/env bash
# post-plan.sh — post a high-blast-radius plan as a Jira comment for
# human review. Strictly deterministic — no LLM calls. The orchestrator
# (interactive Claude Code subagent) calls this when the blast-radius
# detector flags a high-risk change.
#
# The comment uses Jira wiki-markup with a clear marker so humans
# Cmd+F'ing for "Plan-mode review" find every plan-checkpoint in the
# project history.
#
# Usage:
#   echo "...plan body in wiki-markup..." | post-plan.sh TAMD-XX
# OR
#   post-plan.sh TAMD-XX < plan.md
#
# Required env:
#   JIRA_USER_EMAIL  — Atlassian account email
#   JIRA_API_TOKEN   — Atlassian API token (id.atlassian.com → Security)
# Optional env:
#   JIRA_BASE_URL    — defaults to https://mabl.atlassian.net

set -euo pipefail

ticket="${1:-}"
if [ -z "$ticket" ]; then
  echo "Usage: post-plan.sh <TICKET-KEY> < plan.md" >&2
  exit 2
fi

if [ -z "${JIRA_USER_EMAIL:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
  echo "post-plan.sh: JIRA_USER_EMAIL and JIRA_API_TOKEN must be set" >&2
  exit 2
fi

JIRA_BASE_URL="${JIRA_BASE_URL:-https://mabl.atlassian.net}"

plan=$(cat)

if [ -z "$plan" ]; then
  echo "post-plan.sh: empty plan body on stdin" >&2
  exit 2
fi

# Wiki-markup body with a clear, searchable marker. The "Plan-mode
# review" header is what humans Cmd+F to find every plan checkpoint
# across the project's audit trail.
body=$(cat <<EOF
*🛑 Plan-mode review — high blast radius detected*

The orchestrator paused before opening a PR because this change touches a high-risk surface area. Please review the plan below and reply with one of:

* *Approved* — orchestrator proceeds to open the PR (reply in Claude Code)
* *Reject: <reason>* — orchestrator stops; revise the plan and re-emit

----

${plan}

----

_Posted by the orchestrator's plan-mode gate. See \`scripts/orchestrator-plan/\` for the detection rules and override flags._
EOF
)

payload=$(jq -n --arg body "$body" '{body: $body}')

response=$(curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
  -X POST \
  -H 'Content-type: application/json' \
  -H 'X-Atlassian-Token: no-check' \
  --data "$payload" \
  "${JIRA_BASE_URL}/rest/api/2/issue/${ticket}/comment" 2>&1) \
  || { echo "post-plan.sh: failed to post to ${ticket}: ${response}" >&2; exit 1; }

comment_id=$(printf '%s' "$response" | jq -r '.id // empty')
echo "✓ plan posted to ${ticket} (comment id: ${comment_id:-unknown})"
echo "  ${JIRA_BASE_URL}/browse/${ticket}?focusedCommentId=${comment_id}"
