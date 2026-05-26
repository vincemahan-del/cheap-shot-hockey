#!/usr/bin/env bash
# ci-notify.sh — minimal Slack + Jira notifier for CI gates.
#
# Posts a single-line Slack message and a short Jira comment per call.
# mabl's native Slack app carries per-test detail; this notifier only
# announces gate transitions (passed / blocked / shipped).
#
# Usage:
#   ci-notify.sh <outcome> <stage-label> [extra-text]
#
# Outcomes:
#   ok      — gate passed
#   fail    — gate failed / blocked
#   info    — informational
#   receipt — terminal per-ticket receipt (no "Label:" prefix)
#
# Required for posting (skips silently when empty):
#   SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN  (slack)
#   JIRA_USER_EMAIL + JIRA_API_TOKEN      (jira)
#
# Optional env:
#   SLACK_CHANNEL_ID, JIRA_BASE_URL
#   PR_NUMBER, PR_TITLE, PR_AUTHOR
#   PREVIEW_URL, PROD_URL
#   NEXT_GATE       — "Next: <text>" footer
#   JIRA_TRANSITION — Jira transition to apply post-comment (e.g. "Done")
#   CI_NOTIFY_DRY_RUN=1  — print composed message, do not post
set -euo pipefail

outcome="${1:-info}"
stage="${2:-stage}"
extra="${3:-}"

JIRA_BASE_URL="${JIRA_BASE_URL:-https://mabl.atlassian.net}"
repo="${GITHUB_REPOSITORY:-unknown/repo}"
sha_short="$(printf '%.7s' "${GITHUB_SHA:-????????}")"
branch="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-main}}"
server_url="${GITHUB_SERVER_URL:-https://github.com}"
run_url="${server_url}/${repo}/actions/runs/${GITHUB_RUN_ID:-0}"
pr_num="${PR_NUMBER:-}"
pr_url=""
[ -n "$pr_num" ] && pr_url="${server_url}/${repo}/pull/${pr_num}"

# Extract Jira ticket key from branch, then commit subject, then body.
ticket_key=""
if [[ "$branch" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
  ticket_key="${BASH_REMATCH[1]}"
fi
if [ -z "$ticket_key" ]; then
  subject=$(git log -1 --pretty=%s 2>/dev/null || echo "")
  if [[ "$subject" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
    ticket_key="${BASH_REMATCH[1]}"
  fi
fi

case "$outcome" in
  ok)      emoji=":white_check_mark:";   label="Passed" ;;
  fail)    emoji=":rotating_light:";     label="BLOCKED" ;;
  info)    emoji=":information_source:"; label="Update" ;;
  receipt) emoji=":receipt:";            label="" ;;
  *)       emoji=":grey_question:";      label="$outcome" ;;
esac

ticket_prefix=""
[ -n "$ticket_key" ] && ticket_prefix="[${ticket_key}] "

# Compose Slack body — single message, plain URLs (webhook-safe).
if [ -n "$label" ]; then
  slack="${emoji} ${ticket_prefix}${label}: ${stage}"
else
  slack="${emoji} ${ticket_prefix}${stage}"
fi
[ -n "$pr_num" ] && slack+=" · PR #${pr_num}"
[ -n "$extra" ] && slack+=$'\n\n'"${extra}"
[ -n "${NEXT_GATE:-}" ] && slack+=$'\n'":arrow_forward: Next: ${NEXT_GATE}"

# Link cluster: plain URLs separated by · (Slack auto-links them).
links=()
[ -n "$pr_url" ] && links+=("PR #${pr_num} ${pr_url}")
links+=("Actions ${run_url}")
[ -n "${GITHUB_SHA:-}" ] && links+=("Commit ${sha_short} ${server_url}/${repo}/commit/${GITHUB_SHA}")
[ -n "$ticket_key" ] && links+=("Jira ${ticket_key} ${JIRA_BASE_URL}/browse/${ticket_key}")
[ -n "${PREVIEW_URL:-}" ] && links+=("Preview ${PREVIEW_URL}")
[ -n "${PROD_URL:-}" ] && [[ "$stage" == *"Shipped"* || "$stage" == *"Prod"* ]] && links+=("Production ${PROD_URL}")

if [ ${#links[@]} -gt 0 ]; then
  joined=""
  for i in "${!links[@]}"; do
    [ "$i" -gt 0 ] && joined+="  ·  "
    joined+="${links[$i]}"
  done
  slack+=$'\n'":link: ${joined}"
fi

# Dry-run: print only.
if [ "${CI_NOTIFY_DRY_RUN:-0}" = "1" ]; then
  echo "$slack"
  exit 0
fi

# Slack POST. Bot token preferred (supports threading if SLACK_THREAD_TS is
# set). Falls back to webhook. Non-fatal on error.
if [ -n "${SLACK_BOT_TOKEN:-}" ] && [ -n "${SLACK_CHANNEL_ID:-}" ]; then
  payload=$(jq -n \
    --arg ch  "$SLACK_CHANNEL_ID" \
    --arg txt "$slack" \
    --arg ts  "${SLACK_THREAD_TS:-}" \
    'if $ts != "" then {channel:$ch, text:$txt, mrkdwn:true, thread_ts:$ts}
     else {channel:$ch, text:$txt, mrkdwn:true} end')
  curl -fsS -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    -H 'Content-type: application/json' \
    --data "$payload" >/dev/null 2>&1 \
    || echo "slack post failed (non-fatal)" >&2
elif [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  curl -fsS -X POST \
    -H 'Content-type: application/json' \
    --data "$(jq -n --arg t "$slack" '{text:$t}')" \
    "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 \
    || echo "slack post failed (non-fatal)" >&2
fi

# Jira comment + optional transition. Non-fatal on error.
if [ -n "$ticket_key" ] && [ -n "${JIRA_USER_EMAIL:-}" ] && [ -n "${JIRA_API_TOKEN:-}" ]; then
  outcome_upper=$(printf '%s' "$outcome" | tr '[:lower:]' '[:upper:]')
  jira_body="*${stage}* — ${outcome_upper}"$'\n\n'
  [ -n "$pr_url" ] && jira_body+="PR: [#${pr_num}|${pr_url}]"$'\n'
  jira_body+="Commit: \`${sha_short}\` on \`${branch}\`"$'\n'
  [ -n "$extra" ] && jira_body+=$'\n'"${extra}"$'\n'
  [ -n "${NEXT_GATE:-}" ] && jira_body+=$'\n'"Next: ${NEXT_GATE}"$'\n'
  jira_body+=$'\n'"Actions run: ${run_url}"

  payload=$(jq -n --arg t "$jira_body" '{body:$t}')
  curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
    -X POST \
    -H 'Content-type: application/json' \
    -H 'X-Atlassian-Token: no-check' \
    --data "$payload" \
    "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/comment" >/dev/null 2>&1 \
    || echo "jira comment failed (non-fatal)" >&2

  if [ -n "${JIRA_TRANSITION:-}" ]; then
    transitions=$(curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/transitions" 2>/dev/null || echo '{}')
    transition_id=$(printf '%s' "$transitions" \
      | jq -r --arg name "$JIRA_TRANSITION" '.transitions[]? | select(.name==$name) | .id' \
      | head -1)
    if [ -n "$transition_id" ] && [ "$transition_id" != "null" ]; then
      payload=$(jq -n --arg id "$transition_id" '{transition:{id:$id}}')
      curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
        -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/transitions" >/dev/null 2>&1 \
        && echo "jira: ${ticket_key} → ${JIRA_TRANSITION}" \
        || echo "jira transition failed (non-fatal)" >&2
    fi
  fi
fi

echo "ci-notify: outcome=${outcome} stage=\"${stage}\" ticket=\"${ticket_key:-none}\" done"
