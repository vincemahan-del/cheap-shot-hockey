#!/usr/bin/env bash
# cycle-time-receipt.sh — composes a final ":receipt:" Slack post per
# shipped ticket with lead time + GHA minutes. Runs at the end of
# post-deploy-smoke once production is verified.
#
# Strictly deterministic: reads gh api endpoints + arithmetic, no LLM
# calls. The customer ROI story per ticket: "what did it cost and how
# fast did it ship?"
#
# Required env (auto-set by GHA on push events):
#   GITHUB_REPOSITORY   — owner/repo
#   GITHUB_SHA          — main commit (the merge commit)
#   GITHUB_RUN_ID       — current main-push run id (for timing the post-deploy chain)
#   GH_TOKEN            — for `gh api`
#
# Optional:
#   MABL_CLOUD_GATE     — when "disabled", note mabl minutes as paused
#
# Output: posts the receipt via ci-notify.sh

set -euo pipefail

repo="${GITHUB_REPOSITORY:-unknown/repo}"
sha="${GITHUB_SHA:-}"
run_id="${GITHUB_RUN_ID:-}"

if [ -z "$sha" ] || [ -z "$run_id" ]; then
  echo "cycle-time-receipt: missing GITHUB_SHA or GITHUB_RUN_ID" >&2
  exit 0  # non-fatal — receipt is advisory
fi

# ──────────────────────────────────────────────────────────────────
# 1. Find the PR the merge commit came from
# ──────────────────────────────────────────────────────────────────
pr_num=""
pr_url=""
pr_created_at=""
pr_merged_at=""

# `gh pr list --search` finds the PR(s) for this commit
pr_data=$(gh api "repos/${repo}/commits/${sha}/pulls" 2>/dev/null \
  --jq '[.[] | select(.merged_at != null)] | .[0] // {}' \
  || echo "{}")

pr_num=$(echo "$pr_data" | jq -r '.number // ""')
pr_url=$(echo "$pr_data" | jq -r '.html_url // ""')
pr_created_at=$(echo "$pr_data" | jq -r '.created_at // ""')
pr_merged_at=$(echo "$pr_data" | jq -r '.merged_at // ""')

if [ -z "$pr_num" ]; then
  echo "cycle-time-receipt: no merged PR found for sha ${sha:0:7}" >&2
  exit 0
fi

# ──────────────────────────────────────────────────────────────────
# 2. Lead time — PR opened → merged
# ──────────────────────────────────────────────────────────────────
lead_time_human=""
if [ -n "$pr_created_at" ] && [ -n "$pr_merged_at" ]; then
  created_ts=$(date -d "$pr_created_at" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$pr_created_at" +%s 2>/dev/null || echo "0")
  merged_ts=$(date -d "$pr_merged_at" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$pr_merged_at" +%s 2>/dev/null || echo "0")
  if [ "$created_ts" -gt 0 ] && [ "$merged_ts" -gt 0 ]; then
    elapsed=$((merged_ts - created_ts))
    if [ "$elapsed" -lt 60 ]; then
      lead_time_human="${elapsed}s"
    elif [ "$elapsed" -lt 3600 ]; then
      mins=$((elapsed / 60))
      lead_time_human="${mins}m"
    elif [ "$elapsed" -lt 86400 ]; then
      hours=$((elapsed / 3600))
      remaining_mins=$(((elapsed % 3600) / 60))
      lead_time_human="${hours}h ${remaining_mins}m"
    else
      days=$((elapsed / 86400))
      remaining_hours=$(((elapsed % 86400) / 3600))
      lead_time_human="${days}d ${remaining_hours}h"
    fi
  fi
fi

# ──────────────────────────────────────────────────────────────────
# 3. GHA minutes — sum durations across the PR's CI runs + main run
# ──────────────────────────────────────────────────────────────────
total_seconds=0
runs_counted=0

# Get all workflow runs for the head_sha (PR CI) AND the main-push merge commit
# We use `?event=pull_request&head_sha=...` to get PR runs, then add the main-push run
head_sha=$(echo "$pr_data" | jq -r '.head.sha // ""')

if [ -n "$head_sha" ]; then
  pr_runs_timing=$(gh api "repos/${repo}/actions/runs?head_sha=${head_sha}&per_page=20" \
    --jq '[.workflow_runs[] | select(.event=="pull_request") | .id]' 2>/dev/null \
    || echo '[]')
  for run in $(echo "$pr_runs_timing" | jq -r '.[]'); do
    timing=$(gh api "repos/${repo}/actions/runs/${run}/timing" 2>/dev/null \
      --jq '.run_duration_ms // 0' || echo "0")
    if [ "$timing" -gt 0 ]; then
      total_seconds=$((total_seconds + timing / 1000))
      runs_counted=$((runs_counted + 1))
    fi
  done
fi

# Add the main-push run (this current run)
main_run_timing=$(gh api "repos/${repo}/actions/runs/${run_id}/timing" 2>/dev/null \
  --jq '.run_duration_ms // 0' || echo "0")
if [ "$main_run_timing" -gt 0 ]; then
  total_seconds=$((total_seconds + main_run_timing / 1000))
  runs_counted=$((runs_counted + 1))
fi

gha_human=""
if [ "$total_seconds" -gt 0 ]; then
  if [ "$total_seconds" -lt 60 ]; then
    gha_human="${total_seconds}s"
  else
    mins=$((total_seconds / 60))
    secs=$((total_seconds % 60))
    gha_human="${mins}m ${secs}s"
  fi
fi

# ──────────────────────────────────────────────────────────────────
# 3b. Human touches — PR reviews + approvers + manual reruns
# ──────────────────────────────────────────────────────────────────
human_touches_line=""
if [ -n "$pr_num" ]; then
  reviews_json=$(gh api "repos/${repo}/pulls/${pr_num}/reviews" 2>/dev/null || echo '[]')
  # Bot-authored reviews (e.g. github-advanced-security[bot] code-scanning
  # annotations) are NOT human touches — filter them out so a bot comment
  # doesn't suppress the "fully autonomous" line. See TAMD-141.
  review_count=$(echo "$reviews_json" | jq -r '[.[] | select(.user.type != "Bot")] | length')
  approver_handles=$(echo "$reviews_json" \
    | jq -r '[.[] | select(.user.type != "Bot" and .state=="APPROVED") | .user.login] | unique | join(", ")')

  # Manual reruns = workflow_dispatch events OR UI-driven reruns
  # (run_attempt > 1). GitHub's "Re-run failed jobs" button does NOT fire
  # workflow_dispatch — it re-fires the original event and bumps
  # run_attempt. Without this, the receipt would claim "0 manual reruns"
  # even when a human clicked Re-run during the cycle.
  manual_runs=0
  if [ -n "$head_sha" ]; then
    manual_runs=$(gh api "repos/${repo}/actions/runs?head_sha=${head_sha}&per_page=50" \
      --jq '[.workflow_runs[] | select(.event=="workflow_dispatch" or .run_attempt > 1)] | length' 2>/dev/null \
      || echo "0")
  fi

  # Bullet labels rendered as plain text — Slack Workflow Builder
  # webhook doesn't reliably parse `*bold*` mid-body, so the asterisks
  # were showing as literal characters in the channel.
  if [ "$review_count" -gt 0 ] || [ "$manual_runs" -gt 0 ]; then
    human_touches_line="• Human touches: ${review_count} reviews"
    [ -n "$approver_handles" ] && human_touches_line+=" (approved by ${approver_handles})"
    [ "$manual_runs" -gt 0 ] && human_touches_line+=", ${manual_runs} manual reruns"
  else
    human_touches_line="• Human touches: 0 reviews, 0 manual reruns (fully autonomous)"
  fi
fi

# ──────────────────────────────────────────────────────────────────
# 3c. CI attempts — count failed vs successful workflow runs on head_sha
# ──────────────────────────────────────────────────────────────────
ci_attempts_line=""
if [ -n "$head_sha" ]; then
  ci_runs_json=$(gh api "repos/${repo}/actions/runs?head_sha=${head_sha}&per_page=50" \
    --jq '[.workflow_runs[] | select(.event=="pull_request")]' 2>/dev/null \
    || echo '[]')
  ci_total=$(echo "$ci_runs_json" | jq -r 'length // 0')
  ci_failed=$(echo "$ci_runs_json" | jq -r '[.[] | select(.conclusion=="failure")] | length // 0')
  ci_success=$(echo "$ci_runs_json" | jq -r '[.[] | select(.conclusion=="success")] | length // 0')

  if [ "$ci_total" -gt 0 ]; then
    if [ "$ci_failed" -gt 0 ]; then
      ci_attempts_line="• CI attempts: ${ci_total} runs (${ci_failed} failed → ${ci_success} green)"
    else
      ci_attempts_line="• CI attempts: ${ci_total} runs, all green (no retries)"
    fi
  fi
fi

# ──────────────────────────────────────────────────────────────────
# 4. Compose receipt body — Slack mrkdwn, posted via ci-notify.sh
# ──────────────────────────────────────────────────────────────────
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The body — bullets in plain text (no `*bold*`). The Slack Workflow
# Builder webhook renders mid-body `*` markers as literal characters,
# so the asterisks were showing in the channel.
#
# Note: a "mabl minutes" bullet was removed alongside scripts/mabl-cloud-minutes.sh
# in chore/cut-mabl-cloud-minutes — the mabl REST list-endpoint shape varies
# by tier and the bullet was rendering "n/a" on every receipt.
receipt_body="• Lead time: ${lead_time_human:-unknown} (PR open → merged)"$'\n'
receipt_body+="• GHA minutes: ${gha_human:-unknown}"
[ "$runs_counted" -gt 0 ] && receipt_body+=" across ${runs_counted} workflow runs"
receipt_body+=$'\n'
[ -n "$ci_attempts_line" ] && receipt_body+="${ci_attempts_line}"$'\n'
[ -n "$human_touches_line" ] && receipt_body+="${human_touches_line}"$'\n'

# Strip the trailing \n so ci-notify's appended \n (from the receipt-
# outcome render loop) doesn't double up into a blank line before the
# link cluster.
receipt_body="${receipt_body%$'\n'}"

# Post via ci-notify.sh's `receipt` outcome — single ":receipt: [TICKET]
# Cost + cycle-time receipt" headline, no "Update:" prefix.
# Pass PR_NUMBER through so the headline + footer can reference the
# specific PR that triggered this main-push receipt (instead of just
# showing "branch main", which is always true for receipts).
PR_NUMBER="${pr_num}" bash "${script_dir}/ci-notify.sh" receipt "Cost + cycle-time receipt" "$receipt_body"

echo "cycle-time-receipt: posted (lead=${lead_time_human:-?} gha=${gha_human:-?} runs=${runs_counted})"
