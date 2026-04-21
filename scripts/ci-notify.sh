#!/usr/bin/env bash
# ci-notify.sh — unified Slack + Jira notifier for GHA gate transitions.
#
# Called from each GHA gate job's success/failure notify step. Posts a
# rich Slack message and, if the PR / branch name contains a Jira
# ticket key (e.g. TAMD-82), appends a comment on that ticket.
#
# Usage:
#   ci-notify.sh <outcome> <stage-label> [extra-markdown]
#
# Where:
#   outcome       = "ok" | "fail" | "info"
#   stage-label   = short human-readable stage name (e.g. "T2 mabl Preview")
#   extra         = optional extra markdown to append (links, commit, etc.)
#
# Env vars read (from GHA secrets + built-ins):
#   SLACK_WEBHOOK_URL     (optional; skips Slack if empty)
#   JIRA_BASE_URL         (default: https://mabl.atlassian.net)
#   JIRA_USER_EMAIL       (optional; skips Jira if empty)
#   JIRA_API_TOKEN        (optional; skips Jira if empty)
#   JIRA_TRANSITION       (optional; name of a Jira transition to apply after
#                          the comment lands, e.g. "In Progress" or "Done".
#                          No-op if the ticket is already in that status.)
#   GITHUB_REPOSITORY     (auto, e.g. owner/repo)
#   GITHUB_SHA            (auto)
#   GITHUB_REF_NAME       (auto, branch name)
#   GITHUB_HEAD_REF       (auto on PR, branch name of PR head)
#   GITHUB_RUN_ID         (auto)
#   GITHUB_SERVER_URL     (auto, e.g. https://github.com)
#   GITHUB_EVENT_NAME     (auto)
#   PR_NUMBER             (optional; GHA passes via `github.event.pull_request.number`)
set -euo pipefail

outcome="${1:-info}"
stage="${2:-stage}"
extra="${3:-}"

JIRA_BASE_URL="${JIRA_BASE_URL:-https://mabl.atlassian.net}"
repo="${GITHUB_REPOSITORY:-unknown/repo}"
sha_short="$(printf '%.7s' "${GITHUB_SHA:-????????}")"
branch="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-main}}"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${repo}/actions/runs/${GITHUB_RUN_ID:-0}"
pr_num="${PR_NUMBER:-}"
pr_link=""
if [ -n "$pr_num" ]; then
  pr_link="${GITHUB_SERVER_URL:-https://github.com}/${repo}/pull/${pr_num}"
fi

# Extract Jira ticket key — try multiple sources so both PR events
# (branch name) and main-push events (commit subject / body) land the
# comment on the right ticket.
ticket_key=""
key_source=""

# Try 1: branch name (works on PR events and feature-branch pushes)
if [[ "$branch" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
  ticket_key="${BASH_REMATCH[1]}"
  key_source="branch"
fi

# Try 2: commit subject (works on main-push merge commits like
# "Merge pull request #7 from owner/TAMD-82/...")
if [ -z "$ticket_key" ]; then
  subject=$(git log -1 --pretty=%s 2>/dev/null || echo "")
  if [[ "$subject" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
    ticket_key="${BASH_REMATCH[1]}"
    key_source="commit-subject"
  fi
fi

# Try 3: commit body (covers squash-merges where the subject may be
# rewritten but the body preserves the original branch reference)
if [ -z "$ticket_key" ]; then
  body=$(git log -1 --pretty=%B 2>/dev/null || echo "")
  if [[ "$body" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
    ticket_key="${BASH_REMATCH[1]}"
    key_source="commit-body"
  fi
fi

# Compose emoji + prefix per outcome.
case "$outcome" in
  ok)   emoji=":white_check_mark:"; word="passed" ;;
  fail) emoji=":rotating_light:";   word="failed" ;;
  info) emoji=":information_source:"; word="update" ;;
  *)    emoji=":grey_question:";    word="$outcome" ;;
esac

# ──────────────────────────────────────────────────────────────────
# Slack
# ──────────────────────────────────────────────────────────────────
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  slack_msg="${emoji} *${stage}* ${word}"
  slack_msg+=$'\n'"repo: \`${repo}\` · branch: \`${branch}\` · commit: \`${sha_short}\`"
  [ -n "$ticket_key" ] && slack_msg+=$'\n'"jira: <${JIRA_BASE_URL}/browse/${ticket_key}|${ticket_key}>"
  [ -n "$pr_link" ]    && slack_msg+=$'\n'"pr: <${pr_link}|#${pr_num}>"
  slack_msg+=$'\n'"workflow: <${run_url}|run ${GITHUB_RUN_ID:-?}>"
  [ -n "$extra" ]      && slack_msg+=$'\n'"${extra}"

  curl -fsS -X POST \
    -H 'Content-type: application/json' \
    --data "$(jq -n --arg t "$slack_msg" '{text:$t}')" \
    "$SLACK_WEBHOOK_URL" >/dev/null || echo "slack post failed (non-fatal)" >&2
fi

# ──────────────────────────────────────────────────────────────────
# Jira comment (only if ticket key detected + creds present)
# ──────────────────────────────────────────────────────────────────
if [ -n "$ticket_key" ] && [ -n "${JIRA_USER_EMAIL:-}" ] && [ -n "${JIRA_API_TOKEN:-}" ]; then
  jira_body="*${stage}* ${word}"$'\n\n'
  jira_body+="|Field|Value|"$'\n'
  jira_body+="|--|--|"$'\n'
  jira_body+="|repo|${repo}|"$'\n'
  jira_body+="|branch|${branch}|"$'\n'
  jira_body+="|commit|${sha_short}|"$'\n'
  [ -n "$pr_link" ] && jira_body+="|pr|[#${pr_num}|${pr_link}]|"$'\n'
  jira_body+="|workflow run|[link|${run_url}]|"$'\n'
  [ -n "$extra" ]   && jira_body+=$'\n'"${extra}"$'\n'

  # Jira ADF-escape via jq to a proper JSON comment body.
  payload=$(jq -n --arg t "$jira_body" '{body:$t}')

  curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
    -X POST \
    -H 'Content-type: application/json' \
    -H 'X-Atlassian-Token: no-check' \
    --data "$payload" \
    "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/comment" >/dev/null \
    || echo "jira comment failed (non-fatal)" >&2

  # ────────────────────────────────────────────────────────────
  # Optional: transition the ticket to the named status.
  # ────────────────────────────────────────────────────────────
  if [ -n "${JIRA_TRANSITION:-}" ]; then
    # Look up the transition ID by name.
    transitions=$(curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/transitions" 2>/dev/null || echo '{}')
    transition_id=$(echo "$transitions" \
      | jq -r --arg name "$JIRA_TRANSITION" '.transitions[]? | select(.name==$name) | .id' \
      | head -1)

    # Check current status — skip if already there.
    current_status=$(curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}?fields=status" 2>/dev/null \
      | jq -r '.fields.status.name' 2>/dev/null || echo "")

    if [ "$current_status" = "$JIRA_TRANSITION" ]; then
      echo "jira: ${ticket_key} already in status '${JIRA_TRANSITION}', skipping transition"
    elif [ -z "$transition_id" ] || [ "$transition_id" = "null" ]; then
      echo "jira: transition '${JIRA_TRANSITION}' not available for ${ticket_key} (current: ${current_status:-unknown}) — skipping" >&2
    else
      payload=$(jq -n --arg id "$transition_id" '{transition:{id:$id}}')
      curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
        -X POST \
        -H 'Content-type: application/json' \
        --data "$payload" \
        "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/transitions" >/dev/null \
        && echo "jira: ${ticket_key} transitioned '${current_status}' → '${JIRA_TRANSITION}'" \
        || echo "jira transition failed (non-fatal)" >&2
    fi
  fi
fi

echo "ci-notify: outcome=${outcome} stage=\"${stage}\" ticket=\"${ticket_key:-none}\" (source=${key_source:-n/a}) transition=\"${JIRA_TRANSITION:-none}\" done"
