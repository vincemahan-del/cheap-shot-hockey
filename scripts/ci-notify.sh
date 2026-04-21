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

# Extract Jira ticket key from branch name or PR title. Regex matches
# the standard Jira pattern at the start of the branch (e.g. TAMD-82).
ticket_key=""
if [[ "$branch" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
  ticket_key="${BASH_REMATCH[1]}"
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
fi

echo "ci-notify: outcome=${outcome} stage=\"${stage}\" ticket=\"${ticket_key:-none}\" done"
