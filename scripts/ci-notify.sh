#!/usr/bin/env bash
# ci-notify.sh — clean, human-readable Slack + Jira notifier for CI gates.
#
# Called from each GHA gate job. Composes a structured message per
# outcome (ok/fail/info) and posts to Slack (if SLACK_WEBHOOK_URL set)
# plus a Jira comment on the ticket referenced by the branch/commit.
#
# Design goals:
#   - Key status in the header, not buried
#   - Metrics in a short block (test counts, coverage, diff stats)
#   - Links cluster at the end for traceability + review
#   - Human-readable, zero CI jargon in the headline
#
# Usage:
#   ci-notify.sh <outcome> <stage-label> [extra-text]
#
# Outcomes:
#   ok    — gate passed
#   fail  — gate failed / blocked
#   info  — informational (rare; e.g. "waiting for Vercel")
#
# Env vars (structured context — all optional, composed when set):
#
#   Required creds (notification skips silently when empty):
#     SLACK_WEBHOOK_URL
#     JIRA_USER_EMAIL
#     JIRA_API_TOKEN
#
#   GitHub context (auto on GHA runners):
#     GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_RUN_ID, GITHUB_SERVER_URL,
#     GITHUB_HEAD_REF, GITHUB_REF_NAME, GITHUB_EVENT_NAME
#     PR_NUMBER (set by GHA workflow from pull_request.number)
#     PR_TITLE  (optional; set by workflow from pull_request.title)
#     PR_AUTHOR (optional; set by workflow from pull_request.user.login)
#
#   Code-change stats (populate for PR-opened / build notifications):
#     DIFF_FILES       — number of files changed
#     DIFF_ADDITIONS   — lines added
#     DIFF_DELETIONS   — lines removed
#
#   Unit-test metrics (populate for build notifications):
#     TEST_TOTAL       — e.g. 73
#     TEST_PASSED      — e.g. 73
#     TEST_FAILED      — e.g. 0
#     COVERAGE_LINES   — e.g. 97.97
#     COVERAGE_BRANCHES
#     COVERAGE_THRESHOLD  — e.g. 90 (for display only)
#
#   Newman metrics (populate for T1 smoke notifications):
#     NEWMAN_REQUESTS     — e.g. 11
#     NEWMAN_ASSERTIONS   — e.g. 37
#     NEWMAN_FAILURES     — e.g. 0
#     NEWMAN_DURATION_MS  — e.g. 326
#
#   Mabl metrics (populate for cloud-gate notifications):
#     MABL_PLAN_NAME      — e.g. CSH-SMOKE-PR
#     MABL_PLAN_URL       — direct link to the plan run in app.mabl.com
#     MABL_TEST_TOTAL     — e.g. 4
#     MABL_TEST_PASSED    — e.g. 4
#     MABL_TEST_FAILED    — e.g. 0
#
#   Traceability links (optional, cluster in the footer):
#     JENKINS_JOB_URL   — top-level Jenkins job page
#     JENKINS_BUILD_URL — specific Jenkins build page (if known)
#     PREVIEW_URL       — Vercel preview URL for this PR
#     PROD_URL          — Production URL
#
#   Optional behavior:
#     JIRA_TRANSITION   — name of a Jira transition to apply post-comment
#     NEXT_GATE         — human-readable "next up" hint for the footer
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
pr_title="${PR_TITLE:-}"
pr_author="${PR_AUTHOR:-}"

# ──────────────────────────────────────────────────────────────────
# Extract Jira ticket key (multi-source: branch, commit subject, body)
# ──────────────────────────────────────────────────────────────────
ticket_key=""
key_source=""
if [[ "$branch" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
  ticket_key="${BASH_REMATCH[1]}"; key_source="branch"
fi
if [ -z "$ticket_key" ]; then
  subject=$(git log -1 --pretty=%s 2>/dev/null || echo "")
  if [[ "$subject" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
    ticket_key="${BASH_REMATCH[1]}"; key_source="commit-subject"
  fi
fi
if [ -z "$ticket_key" ]; then
  body=$(git log -1 --pretty=%B 2>/dev/null || echo "")
  if [[ "$body" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
    ticket_key="${BASH_REMATCH[1]}"; key_source="commit-body"
  fi
fi

# ──────────────────────────────────────────────────────────────────
# Outcome-specific headline + emoji
# ──────────────────────────────────────────────────────────────────
case "$outcome" in
  ok)
    headline_emoji=":white_check_mark:"
    headline_label="Passed"
    jira_state="OK"
    ;;
  fail)
    headline_emoji=":rotating_light:"
    headline_label="BLOCKED"
    jira_state="FAIL"
    ;;
  info)
    headline_emoji=":information_source:"
    headline_label="Update"
    jira_state="INFO"
    ;;
  *)
    headline_emoji=":grey_question:"
    headline_label="$outcome"
    jira_state="$outcome"
    ;;
esac

# ──────────────────────────────────────────────────────────────────
# Compose Slack message (plain text with mrkdwn)
# ──────────────────────────────────────────────────────────────────
slack=""
# Header line: emoji · headline · stage · PR title (if present)
slack+="${headline_emoji} *${headline_label}: ${stage}*"
if [ -n "$pr_url" ]; then
  if [ -n "$pr_title" ]; then
    slack+=" — <${pr_url}|PR #${pr_num} ${pr_title}>"
  else
    slack+=" — <${pr_url}|PR #${pr_num}>"
  fi
elif [ -n "$ticket_key" ]; then
  slack+=" — ${ticket_key}"
fi
slack+=$'\n'

# Author + commit line (on PR context)
author_line=""
[ -n "$pr_author" ] && author_line+="by *${pr_author}* "
author_line+="on \`${sha_short}\` (branch \`${branch}\`)"
slack+=$'\n'"${author_line}"$'\n'

# Metric block
metric_block=""
if [ -n "${DIFF_FILES:-}" ] || [ -n "${DIFF_ADDITIONS:-}" ]; then
  metric_block+=$'\n'":package: *Code changes:* ${DIFF_FILES:-?} files, +${DIFF_ADDITIONS:-0}/-${DIFF_DELETIONS:-0} lines"
fi
if [ -n "${TEST_TOTAL:-}" ]; then
  pass_str="${TEST_PASSED:-${TEST_TOTAL}}"
  fail_str="${TEST_FAILED:-0}"
  if [ "$fail_str" -gt 0 ] 2>/dev/null; then
    metric_block+=$'\n'":test_tube: *Unit tests:* ${pass_str}/${TEST_TOTAL} passed, *${fail_str} failed* :x:"
  else
    metric_block+=$'\n'":test_tube: *Unit tests:* ${pass_str}/${TEST_TOTAL} passed"
  fi
  if [ -n "${COVERAGE_LINES:-}" ]; then
    cov_threshold="${COVERAGE_THRESHOLD:-90}"
    cov_indicator=":white_check_mark:"
    if [ "$(printf '%.0f' "$COVERAGE_LINES")" -lt "$cov_threshold" ] 2>/dev/null; then
      cov_indicator=":x:"
    fi
    metric_block+=$'\n'":bar_chart: *Coverage:* ${COVERAGE_LINES}% lines (gate ${cov_threshold}% ${cov_indicator})"
  fi
fi
if [ -n "${NEWMAN_REQUESTS:-}" ]; then
  newman_pass=$((${NEWMAN_ASSERTIONS:-0} - ${NEWMAN_FAILURES:-0}))
  duration_sec=""
  [ -n "${NEWMAN_DURATION_MS:-}" ] && duration_sec=$(awk -v ms="$NEWMAN_DURATION_MS" 'BEGIN{printf "%.2f", ms/1000}')
  metric_block+=$'\n'":zap: *Newman:* ${NEWMAN_REQUESTS} requests, ${newman_pass}/${NEWMAN_ASSERTIONS:-?} assertions passed"
  [ -n "$duration_sec" ] && metric_block+=" in ${duration_sec}s"
  if [ "${NEWMAN_FAILURES:-0}" -gt 0 ] 2>/dev/null; then
    metric_block+=$'\n':x:" *${NEWMAN_FAILURES} assertion(s) failed — merge blocked*"
  fi
fi
if [ -n "${MABL_PLAN_NAME:-}" ]; then
  m_total="${MABL_TEST_TOTAL:-?}"
  m_pass="${MABL_TEST_PASSED:-?}"
  m_fail="${MABL_TEST_FAILED:-0}"
  metric_block+=$'\n'":robot_face: *mabl plan:* ${MABL_PLAN_NAME} — ${m_pass}/${m_total} tests passed"
  if [ "$m_fail" -gt 0 ] 2>/dev/null; then
    metric_block+=" (:x: ${m_fail} failed)"
  fi
fi
[ -n "$metric_block" ] && slack+="${metric_block}"$'\n'

# Extra (free-form context for the specific gate)
if [ -n "$extra" ]; then
  slack+=$'\n'"${extra}"$'\n'
fi

# Next-gate footer
if [ -n "${NEXT_GATE:-}" ]; then
  slack+=$'\n'":arrow_forward: *Next up:* ${NEXT_GATE}"$'\n'
fi

# Links cluster
links=()
[ -n "$pr_url" ] && links+=("<${pr_url}|PR #${pr_num}>")
links+=("<${run_url}|GitHub Actions run>")
[ -n "$ticket_key" ] && links+=("<${JIRA_BASE_URL}/browse/${ticket_key}|Jira ${ticket_key}>")
[ -n "${MABL_PLAN_URL:-}" ] && links+=("<${MABL_PLAN_URL}|mabl plan run>")
[ -n "${JENKINS_BUILD_URL:-}" ] && links+=("<${JENKINS_BUILD_URL}|Jenkins build>")
if [ -z "${JENKINS_BUILD_URL:-}" ] && [ -n "${JENKINS_JOB_URL:-}" ]; then
  links+=("<${JENKINS_JOB_URL}|Jenkins job>")
fi
[ -n "${PREVIEW_URL:-}" ] && links+=("<${PREVIEW_URL}|Preview site>")
[ -n "${PROD_URL:-}" ] && links+=("<${PROD_URL}|Production>")

if [ ${#links[@]} -gt 0 ]; then
  slack+=$'\n'":link: $(IFS=' · '; echo "${links[*]}")"
fi

# ──────────────────────────────────────────────────────────────────
# Slack POST
# ──────────────────────────────────────────────────────────────────
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  curl -fsS -X POST \
    -H 'Content-type: application/json' \
    --data "$(jq -n --arg t "$slack" '{text:$t}')" \
    "$SLACK_WEBHOOK_URL" >/dev/null || echo "slack post failed (non-fatal)" >&2
fi

# ──────────────────────────────────────────────────────────────────
# Compose Jira comment (wiki-markup style for REST API v2)
# ──────────────────────────────────────────────────────────────────
jira_body="*${stage}* — *${jira_state}*"$'\n\n'

if [ -n "$pr_url" ]; then
  jira_body+="*PR:* [#${pr_num} ${pr_title}|${pr_url}]"
  [ -n "$pr_author" ] && jira_body+=" (by ${pr_author})"
  jira_body+=$'\n'
fi
jira_body+="*Commit:* \`${sha_short}\` on branch \`${branch}\`"$'\n'
jira_body+="*Event:* ${GITHUB_EVENT_NAME:-unknown}"$'\n'

if [ -n "$metric_block" ]; then
  jira_body+=$'\n'"*Metrics:*"$'\n'
  # Strip Slack mrkdwn markers (leave the content readable as plain text in Jira)
  plain=$(echo "$metric_block" | sed 's/\*//g' | sed 's/:[a-z_]*://g')
  jira_body+="${plain}"$'\n'
fi

[ -n "$extra" ] && jira_body+=$'\n'"${extra}"$'\n'
[ -n "${NEXT_GATE:-}" ] && jira_body+=$'\n'"*Next:* ${NEXT_GATE}"$'\n'

jira_body+=$'\n'"*Traceability:*"$'\n'
[ -n "$pr_url" ]                   && jira_body+="- GitHub PR: ${pr_url}"$'\n'
jira_body+="- GitHub Actions run: ${run_url}"$'\n'
[ -n "${MABL_PLAN_URL:-}" ]        && jira_body+="- mabl plan run: ${MABL_PLAN_URL}"$'\n'
[ -n "${JENKINS_BUILD_URL:-}" ]    && jira_body+="- Jenkins build: ${JENKINS_BUILD_URL}"$'\n'
if [ -z "${JENKINS_BUILD_URL:-}" ] && [ -n "${JENKINS_JOB_URL:-}" ]; then
  jira_body+="- Jenkins job: ${JENKINS_JOB_URL}"$'\n'
fi
[ -n "${PREVIEW_URL:-}" ]          && jira_body+="- Vercel Preview: ${PREVIEW_URL}"$'\n'
[ -n "${PROD_URL:-}" ]             && jira_body+="- Production: ${PROD_URL}"$'\n'

# ──────────────────────────────────────────────────────────────────
# Jira comment + optional transition
# ──────────────────────────────────────────────────────────────────
if [ -n "$ticket_key" ] && [ -n "${JIRA_USER_EMAIL:-}" ] && [ -n "${JIRA_API_TOKEN:-}" ]; then
  payload=$(jq -n --arg t "$jira_body" '{body:$t}')
  curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
    -X POST \
    -H 'Content-type: application/json' \
    -H 'X-Atlassian-Token: no-check' \
    --data "$payload" \
    "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/comment" >/dev/null \
    || echo "jira comment failed (non-fatal)" >&2

  # Optional transition
  if [ -n "${JIRA_TRANSITION:-}" ]; then
    transitions=$(curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}/transitions" 2>/dev/null || echo '{}')
    transition_id=$(echo "$transitions" \
      | jq -r --arg name "$JIRA_TRANSITION" '.transitions[]? | select(.name==$name) | .id' \
      | head -1)
    current_status=$(curl -fsS -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/2/issue/${ticket_key}?fields=status" 2>/dev/null \
      | jq -r '.fields.status.name' 2>/dev/null || echo "")
    if [ "$current_status" = "$JIRA_TRANSITION" ]; then
      echo "jira: ${ticket_key} already in '${JIRA_TRANSITION}', skipping transition"
    elif [ -z "$transition_id" ] || [ "$transition_id" = "null" ]; then
      echo "jira: transition '${JIRA_TRANSITION}' not available for ${ticket_key} (current: ${current_status:-unknown})" >&2
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
