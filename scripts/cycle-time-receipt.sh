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
  review_count=$(echo "$reviews_json" | jq -r 'length // 0')
  approver_handles=$(echo "$reviews_json" \
    | jq -r '[.[] | select(.state=="APPROVED") | .user.login] | unique | join(", ")')

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

  if [ "$review_count" -gt 0 ] || [ "$manual_runs" -gt 0 ]; then
    human_touches_line="• *Human touches:* ${review_count} reviews"
    [ -n "$approver_handles" ] && human_touches_line+=" (approved by ${approver_handles})"
    [ "$manual_runs" -gt 0 ] && human_touches_line+=", ${manual_runs} manual reruns"
  else
    human_touches_line="• *Human touches:* 0 reviews, 0 manual reruns (fully autonomous)"
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
      ci_attempts_line="• *CI attempts:* ${ci_total} runs (${ci_failed} failed → ${ci_success} green)"
    else
      ci_attempts_line="• *CI attempts:* ${ci_total} runs, all green (no retries)"
    fi
  fi
fi

# ──────────────────────────────────────────────────────────────────
# 3d. Agent tokens — sum __LLM_RECEIPT__ lines from this ticket's runs.
# Receipts are emitted by:
#   - scripts/recovery-agent/index.js (on post-deploy failure)
#   - scripts/llm/emit-receipt.sh (claude.yml + claude-agentic-dod.yml)
# Each is a single-line JSON with cost_usd, model_actual, input/output
# tokens, session_id. We aggregate across the PR's head_sha AND the
# merge commit so both PR-time and post-deploy LLM activity counts.
# Bounded: SKIP_LLM_RECEIPT_AGG=1 disables the gh-run-view loop if a
# fork wants to skip the log fetch (each call is up to a few MB).
# ──────────────────────────────────────────────────────────────────
agent_tokens_line=""
total_llm_cost="0"
total_llm_runs=0
if [ "${SKIP_LLM_RECEIPT_AGG:-0}" = "1" ]; then
  agent_tokens_line="• *Agent tokens:* skipped (SKIP_LLM_RECEIPT_AGG=1)"
else
  shas=()
  [ -n "$head_sha" ] && shas+=("$head_sha")
  [ -n "$GITHUB_SHA" ] && [ "$GITHUB_SHA" != "$head_sha" ] && shas+=("$GITHUB_SHA")

  llm_receipts_tmp=$(mktemp)
  trap 'rm -f "$llm_receipts_tmp"' EXIT

  # Disable pipefail inside the aggregator: grep returns 1 when it finds
  # zero matches in a run's log (most runs have no LLM receipts), which
  # with `set -o pipefail` bubbles up and trips `set -e`. The aggregator
  # is best-effort by design — a missing receipt is a real signal, not
  # an error.
  set +o pipefail
  for s in "${shas[@]}"; do
    run_ids=$(gh api "repos/${repo}/actions/runs?head_sha=${s}&per_page=50" \
      --jq '.workflow_runs[].id' 2>/dev/null || true)
    while IFS= read -r rid; do
      [ -z "$rid" ] && continue
      gh run view "$rid" --log 2>/dev/null \
        | grep -oE '__LLM_RECEIPT__ \{[^}]*\}' \
        | sed 's/^__LLM_RECEIPT__ //' \
        | while IFS= read -r line; do
            echo "$line" | jq -c . >/dev/null 2>&1 && echo "$line" >> "$llm_receipts_tmp"
          done
    done <<< "$run_ids"
  done
  set -o pipefail

  total_llm_runs=$(wc -l < "$llm_receipts_tmp" | tr -d ' ')
  if [ "$total_llm_runs" -gt 0 ]; then
    total_llm_cost=$(jq -s '[.[] | (.cost_usd // 0)] | add // 0' "$llm_receipts_tmp")
    # Per-model breakdown for the receipt — informational, optional.
    by_model=$(jq -s -r '
      group_by(.model_actual // "unknown")
      | map({m: .[0].model_actual // "unknown", c: ([.[] | (.cost_usd // 0)] | add // 0), n: length})
      | sort_by(-.c)
      | .[]
      | "  - \(.m): $\(.c | . * 10000 | round / 10000) (\(.n) runs)"
    ' "$llm_receipts_tmp")
    cost_fmt=$(printf '%.4f' "$total_llm_cost")
    agent_tokens_line="• *Agent tokens:* \$${cost_fmt} across ${total_llm_runs} LLM runs"
    if [ -n "$by_model" ] && [ "$total_llm_runs" -gt 1 ]; then
      agent_tokens_line+=$'\n'"$by_model"
    fi
  else
    agent_tokens_line="• *Agent tokens:* \$0.0000 (no LLM runs this ticket)"
  fi
fi

# ──────────────────────────────────────────────────────────────────
# 4. Compose receipt body — Slack mrkdwn, posted via ci-notify.sh
# ──────────────────────────────────────────────────────────────────
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mabl_line=""
case "${MABL_CLOUD_GATE:-enabled}" in
  disabled)
    mabl_line="• *mabl minutes:* paused (toggle disabled)"
    ;;
  *)
    # v1.1 — best-effort capture via mabl-cloud-minutes.sh helper.
    # Window starts at PR creation time so we count both PR-time and
    # post-deploy mabl runs for this ticket.
    if [ -n "$pr_created_at" ]; then
      mabl_helper_output=$(MABL_API_TOKEN="${MABL_API_TOKEN:-}" \
        MABL_APPLICATION_ID="${MABL_APPLICATION_ID:-}" \
        bash "${script_dir}/mabl-cloud-minutes.sh" "$pr_created_at" 2>/dev/null \
        || echo "MABL_CLOUD_MINUTES=n/a")
      mabl_value=$(echo "$mabl_helper_output" | grep "^MABL_CLOUD_MINUTES=" | head -1 | sed 's/^MABL_CLOUD_MINUTES=//')
      if [ -n "$mabl_value" ] && [ "$mabl_value" != "n/a" ]; then
        mabl_line="• *mabl minutes:* ${mabl_value}"
      else
        mabl_line="• *mabl minutes:* n/a (verify MABL_LIST_ENDPOINT in scripts/mabl-cloud-minutes.sh against your tier)"
      fi
    else
      mabl_line="• *mabl minutes:* unknown — could not determine PR window"
    fi
    ;;
esac

receipt_body=":receipt: *Cost + cycle-time receipt*"$'\n\n'
receipt_body+="• *Lead time:* ${lead_time_human:-unknown} (PR open → merged)"$'\n'
receipt_body+="• *GHA minutes:* ${gha_human:-unknown}"
[ "$runs_counted" -gt 0 ] && receipt_body+=" across ${runs_counted} workflow runs"
receipt_body+=$'\n'
receipt_body+="${mabl_line}"$'\n'
receipt_body+="${agent_tokens_line}"$'\n'
[ -n "$ci_attempts_line" ] && receipt_body+="${ci_attempts_line}"$'\n'
[ -n "$human_touches_line" ] && receipt_body+="${human_touches_line}"$'\n'
receipt_body+=$'\n'
receipt_body+="_Lead time + GHA + mabl minutes + agent tokens + retry/review counts computed from native GitHub + mabl APIs + \`__LLM_RECEIPT__\` log lines emitted by each Claude run. Customer ROI story: per-ticket cost AND friction (retries, human touches) are auditable and trend over time, no special instrumentation required._"

# Use ci-notify.sh's "info" outcome to post a non-OK / non-FAIL message
# without injecting a "Passed:" or "BLOCKED:" headline.
bash "${script_dir}/ci-notify.sh" info "Receipt" "$receipt_body"

echo "cycle-time-receipt: posted (lead=${lead_time_human:-?} gha=${gha_human:-?} runs=${runs_counted} agent=\$${total_llm_cost} across ${total_llm_runs} LLM runs)"
