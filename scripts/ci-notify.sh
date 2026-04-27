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
# Compose Slack message — section-headered, code-fence-tabled
# ──────────────────────────────────────────────────────────────────
# Conventions:
#   - [TICKET-XX] prefix on every header (Cmd+F grouping w/o threading)
#   - Section headers: emoji + bold label, one section per concern
#   - Metrics: triple-backtick code fence for monospace alignment
#   - Status/next: Slack blockquote (>) for visual chunking
#   - Footer: italic context + comprehensive link row

ticket_prefix=""
[ -n "$ticket_key" ] && ticket_prefix="[${ticket_key}] "

# URL helpers (computed once, conditionally rendered)
commit_url=""
[ -n "${GITHUB_SHA:-}" ] && commit_url="${server_url}/${repo}/commit/${GITHUB_SHA}"
mabl_workspace_url="https://app.mabl.com/workspaces/pXXgThbNi4HfQOpiZptHfw-w/dashboard"

slack=""
# Legacy variable still referenced in the Jira-comment section below.
# The new section-based Slack layout doesn't use a single metric_block,
# so leave this empty — Jira keeps its PR/commit/event/links content.
metric_block=""

# ── Header ────────────────────────────────────────────────────────
slack+="${headline_emoji} *${ticket_prefix}${headline_label}: ${stage}*"
if [ -n "$pr_url" ]; then
  slack+=" · <${pr_url}|PR #${pr_num}>"
elif [ -n "${GITHUB_SHA:-}" ]; then
  slack+=" · \`${sha_short}\` on \`${branch}\`"
fi
slack+=$'\n'

# ── Section: Changes ──────────────────────────────────────────────
if [ -n "${DIFF_FILES:-}" ] && [ "${DIFF_FILES:-0}" != "0" ]; then
  slack+=$'\n'":clipboard: *Changes*"$'\n'
  slack+='```'$'\n'
  printf -v line "Files          %s\n" "${DIFF_FILES}"
  slack+="$line"
  printf -v line "Lines          +%s / -%s\n" "${DIFF_ADDITIONS:-0}" "${DIFF_DELETIONS:-0}"
  slack+="$line"
  slack+='```'$'\n'
fi

# ── Section: Unit tests + coverage ────────────────────────────────
# Note: Slack does NOT process emoji shortcodes inside ``` fences,
# so we use Unicode glyphs (✅ / ❌) directly in the table rows.
if [ -n "${TEST_TOTAL:-}" ]; then
  cov_threshold="${COVERAGE_THRESHOLD:-90}"
  slack+=$'\n'":test_tube: *Unit tests + coverage*  (gate ${cov_threshold}%)"$'\n'
  slack+='```'$'\n'
  if [ -n "${COVERAGE_LINES:-}" ]; then
    indicator="✅"
    if [ "$(printf '%.0f' "$COVERAGE_LINES")" -lt "$cov_threshold" ] 2>/dev/null; then
      indicator="❌"
    fi
    printf -v line "Lines          %s%%   %s\n" "${COVERAGE_LINES}" "$indicator"
    slack+="$line"
  fi
  if [ -n "${COVERAGE_BRANCHES:-}" ]; then
    indicator="✅"
    if [ "$(printf '%.0f' "$COVERAGE_BRANCHES")" -lt 85 ] 2>/dev/null; then
      indicator="❌"
    fi
    printf -v line "Branches       %s%%   %s\n" "${COVERAGE_BRANCHES}" "$indicator"
    slack+="$line"
  fi
  pass_str="${TEST_PASSED:-${TEST_TOTAL}}"
  fail_str="${TEST_FAILED:-0}"
  if [ "$fail_str" -gt 0 ] 2>/dev/null; then
    printf -v line "Tests          %s/%s passed   %s FAILED  ❌\n" "$pass_str" "$TEST_TOTAL" "$fail_str"
  else
    printf -v line "Tests          %s/%s passed   ✅\n" "$pass_str" "$TEST_TOTAL"
  fi
  slack+="$line"
  slack+='```'$'\n'
fi

# ── Section: Newman results ───────────────────────────────────────
if [ -n "${NEWMAN_REQUESTS:-}" ]; then
  newman_pass=$((${NEWMAN_ASSERTIONS:-0} - ${NEWMAN_FAILURES:-0}))
  duration_sec=""
  [ -n "${NEWMAN_DURATION_MS:-}" ] && duration_sec=$(awk -v ms="$NEWMAN_DURATION_MS" 'BEGIN{printf "%.2f", ms/1000}')
  slack+=$'\n'":zap: *Newman results*"$'\n'
  slack+='```'$'\n'
  printf -v line "Requests       %s\n" "$NEWMAN_REQUESTS"
  slack+="$line"
  if [ "${NEWMAN_FAILURES:-0}" -gt 0 ] 2>/dev/null; then
    printf -v line "Assertions     %s/%s passed   %s FAILED  ❌\n" "$newman_pass" "$NEWMAN_ASSERTIONS" "$NEWMAN_FAILURES"
  else
    printf -v line "Assertions     %s/%s passed   ✅\n" "$newman_pass" "$NEWMAN_ASSERTIONS"
  fi
  slack+="$line"
  if [ -n "$duration_sec" ]; then
    printf -v line "Duration       %ss\n" "$duration_sec"
    slack+="$line"
  fi
  slack+='```'$'\n'
fi

# ── Section: mabl plan ────────────────────────────────────────────
if [ -n "${MABL_PLAN_NAME:-}" ]; then
  slack+=$'\n'":robot_face: *mabl plan*  ${MABL_PLAN_NAME}"$'\n'
  slack+='```'$'\n'
  m_pass="${MABL_TEST_PASSED:-?}"
  m_total="${MABL_TEST_TOTAL:-?}"
  m_fail="${MABL_TEST_FAILED:-0}"
  if [ "$m_fail" -gt 0 ] 2>/dev/null; then
    printf -v line "Tests          %s/%s passed   %s FAILED  ❌\n" "$m_pass" "$m_total" "$m_fail"
  else
    printf -v line "Tests          %s/%s passed   ✅\n" "$m_pass" "$m_total"
  fi
  slack+="$line"
  slack+='```'$'\n'
fi

# ── Section: Required checks (merge-ready stage only) ─────────────
if [ "$stage" = "Merge-ready" ] && [ "$outcome" = "ok" ]; then
  slack+=$'\n'":dart: *Required checks (5/5)*"$'\n'
  slack+='```'$'\n'
  slack+="Stage 1 · code quality                ✅"$'\n'
  slack+="T1 newman (Preview)                   ✅"$'\n'
  slack+="mabl CSH-SMOKE-PR (Preview)           ✅"$'\n'
  slack+="Test impact analysis                  ✅"$'\n'
  slack+="Definition of done                    ✅"$'\n'
  slack+='```'$'\n'
fi

# ── Section: T3 chain (shipped stage only) ────────────────────────
if [ "$stage" = "Shipped to production" ] && [ "$outcome" = "ok" ]; then
  slack+=$'\n'":stopwatch: *T3 chain*"$'\n'
  slack+='```'$'\n'
  slack+="T1 newman (Prod)                      ✅"$'\n'
  slack+="mabl CSH-SMOKE-POSTDEPLOY (Prod)      ✅"$'\n'
  slack+="Vercel prod deploy                    ✅"$'\n'
  slack+='```'$'\n'
fi

# ── Status + next-gate (blockquote, visual chunk separator) ───────
context_lines=()
[ -n "$extra" ] && context_lines+=("${extra}")
[ -n "${NEXT_GATE:-}" ] && context_lines+=(":arrow_forward: Next: ${NEXT_GATE}")
if [ ${#context_lines[@]} -gt 0 ]; then
  slack+=$'\n'
  for line in "${context_lines[@]}"; do
    slack+="> ${line}"$'\n'
  done
fi

# ── Links cluster (comprehensive, fixes IFS bug) ──────────────────
# bash IFS only honors single-char separators, so the previous
# `IFS=' · '; echo "${links[*]}"` silently dropped the dot.
# Build the joined string explicitly.
links=()
[ -n "$pr_url" ] && links+=("<${pr_url}|PR #${pr_num}>")
links+=("<${run_url}|Actions run>")
[ -n "$commit_url" ] && links+=("<${commit_url}|Commit ${sha_short}>")
[ -n "$ticket_key" ] && links+=("<${JIRA_BASE_URL}/browse/${ticket_key}|Jira ${ticket_key}>")
if [ -n "${MABL_PLAN_URL:-}" ]; then
  links+=("<${MABL_PLAN_URL}|mabl plan run>")
elif [ -n "${MABL_PLAN_NAME:-}" ] || [ "$stage" = "Merge-ready" ] || [[ "$stage" == *"mabl"* ]]; then
  links+=("<${mabl_workspace_url}|mabl workspace>")
fi
[ -n "${JENKINS_BUILD_URL:-}" ] && links+=("<${JENKINS_BUILD_URL}|Jenkins build>")
[ -z "${JENKINS_BUILD_URL:-}" ] && [ -n "${JENKINS_JOB_URL:-}" ] && links+=("<${JENKINS_JOB_URL}|Jenkins job>")
[ -n "${PREVIEW_URL:-}" ] && links+=("<${PREVIEW_URL}|Preview>")
# Only include Production URL on terminal "shipped" / "T1 prod" gates
# to avoid auto-unfurled preview cards on every intermediate gate post.
if [ -n "${PROD_URL:-}" ] && \
   { [ "$stage" = "Shipped to production" ] || [[ "$stage" == *"Prod"* ]]; }; then
  links+=("<${PROD_URL}|Production>")
fi

if [ ${#links[@]} -gt 0 ]; then
  joined=""
  for i in "${!links[@]}"; do
    [ "$i" -gt 0 ] && joined+=" · "
    joined+="${links[$i]}"
  done
  slack+=$'\n'":link: ${joined}"
fi

# ── Footer: italic context (author, branch) ───────────────────────
context_footer=""
[ -n "$pr_author" ] && context_footer+="by ${pr_author} · "
context_footer+="branch \`${branch}\`"
slack+=$'\n'"_${context_footer}_"

# ──────────────────────────────────────────────────────────────────
# Slack POST
# Prefers SLACK_BOT_TOKEN + chat.postMessage (supports threading).
# Falls back to SLACK_WEBHOOK_URL (Workflow Builder / Incoming Webhook).
# Set SLACK_THREAD_TS to reply in a thread; leave unset to post at root.
# Outputs "slack_ts=<ts>" to stdout so callers can capture the thread root.
# ──────────────────────────────────────────────────────────────────
if [ -n "${SLACK_BOT_TOKEN:-}" ]; then
  channel="${SLACK_CHANNEL_ID:-C0A321B477Y}"
  payload=$(jq -n \
    --arg ch  "$channel" \
    --arg txt "$slack" \
    --arg ts  "${SLACK_THREAD_TS:-}" \
    'if $ts != "" then {channel:$ch, text:$txt, mrkdwn:true, thread_ts:$ts}
     else {channel:$ch, text:$txt, mrkdwn:true} end')
  response=$(curl -fsS -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    -H 'Content-type: application/json' \
    --data "$payload" 2>/dev/null || echo '{"ok":false}')
  msg_ts=$(printf '%s' "$response" | jq -r '.ts // empty')
  [ -n "$msg_ts" ] && echo "slack_ts=$msg_ts"
  printf '%s' "$response" | jq -e '.ok' >/dev/null 2>&1 \
    || echo "slack post failed (non-fatal): $(printf '%s' "$response" | jq -r '.error // "unknown"')" >&2
elif [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
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
