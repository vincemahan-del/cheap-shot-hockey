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
# 4. Compose receipt body — Slack mrkdwn, posted via ci-notify.sh
# ──────────────────────────────────────────────────────────────────
mabl_line=""
case "${MABL_CLOUD_GATE:-enabled}" in
  disabled)
    mabl_line="• *mabl minutes:* paused (toggle disabled)"
    ;;
  *)
    mabl_line="• *mabl minutes:* not yet captured (v2 — needs MABL_API_TOKEN usage call)"
    ;;
esac

receipt_body=":receipt: *Cost + cycle-time receipt*"$'\n\n'
receipt_body+="• *Lead time:* ${lead_time_human:-unknown} (PR open → merged)"$'\n'
receipt_body+="• *GHA minutes:* ${gha_human:-unknown}"
[ "$runs_counted" -gt 0 ] && receipt_body+=" across ${runs_counted} workflow runs"
receipt_body+=$'\n'
receipt_body+="${mabl_line}"$'\n'
receipt_body+="• *Agent tokens:* not yet captured (v2 — needs ANTHROPIC_API_KEY usage call)"$'\n\n'
receipt_body+="_v1 metrics (lead time + GHA) computable without extra creds. Agent tokens + mabl minutes land when respective API keys are configured. Customer ROI story: per-ticket cost is auditable and trends over time, no special instrumentation required._"

# Use ci-notify.sh's "info" outcome to post a non-OK / non-FAIL message
# without injecting a "Passed:" or "BLOCKED:" headline.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${script_dir}/ci-notify.sh" info "Receipt" "$receipt_body"

echo "cycle-time-receipt: posted (lead=${lead_time_human:-?} gha=${gha_human:-?} runs=${runs_counted})"
