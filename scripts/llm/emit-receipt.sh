#!/usr/bin/env bash
# Emits a single-line __LLM_RECEIPT__ JSON marker from a claude-code-action
# step's execution_file output. Surfaces per-run cost / model / tokens /
# session_id in the GHA logs — searchable when someone asks "what did this
# cost." A future budget-watcher workflow could grep these to roll up daily
# spend; for now the line itself IS the receipt.
#
# Required env (set by the calling workflow):
#   EXECUTION_FILE  — path from `steps.<id>.outputs.execution_file`
#   SESSION_ID      — `steps.<id>.outputs.session_id`
#   WORKFLOW        — workflow filename (e.g. claude.yml)
#   WRITE_MODE      — "true" or "false" (claude.yml only)
#
# Inherited from GHA: GITHUB_RUN_ID, GITHUB_SHA, GITHUB_EVENT_NAME, GITHUB_REPOSITORY.
#
# The execution file is an SDK transcript (NDJSON / JSON-array depending on
# version). We look for the final `result` message, which carries
# total_cost_usd, usage{...}, modelUsage, num_turns, session_id. If we can't
# parse it, we still emit a degraded receipt so the watcher can see the run.

set -euo pipefail

ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
workflow="${WORKFLOW:-unknown}"
run_id="${GITHUB_RUN_ID:-}"
repo="${GITHUB_REPOSITORY:-}"
session="${SESSION_ID:-}"
write_mode="${WRITE_MODE:-false}"
exec_file="${EXECUTION_FILE:-}"

cost="null"
model="null"
input_tokens="null"
output_tokens="null"
cache_read="null"
num_turns="null"
subtype="null"
parsed="false"

if [ -n "$exec_file" ] && [ -f "$exec_file" ]; then
  # The execution file may be a JSON array OR newline-delimited JSON.
  # Try jq on the whole file first; fall back to last-line.
  if jq -e 'type == "array"' "$exec_file" >/dev/null 2>&1; then
    result=$(jq -c '[.[] | select(.type == "result")] | last // empty' "$exec_file" 2>/dev/null || echo "")
    init=$(jq -c '[.[] | select(.type == "system" and .subtype == "init")] | last // empty' "$exec_file" 2>/dev/null || echo "")
  else
    result=$(grep -E '"type"\s*:\s*"result"' "$exec_file" | tail -n 1 || true)
    init=$(grep -E '"type"\s*:\s*"system".*"subtype"\s*:\s*"init"' "$exec_file" | tail -n 1 || true)
  fi

  if [ -n "$result" ]; then
    parsed="true"
    cost=$(echo "$result" | jq -r '.total_cost_usd // "null"')
    input_tokens=$(echo "$result" | jq -r '.usage.input_tokens // "null"')
    output_tokens=$(echo "$result" | jq -r '.usage.output_tokens // "null"')
    cache_read=$(echo "$result" | jq -r '.usage.cache_read_input_tokens // "null"')
    num_turns=$(echo "$result" | jq -r '.num_turns // "null"')
    subtype=$(echo "$result" | jq -r '.subtype // "null"' | jq -R -s 'rtrimstr("\n")')
  fi
  if [ -n "$init" ]; then
    model=$(echo "$init" | jq -r '.model // "null"' | jq -R -s 'rtrimstr("\n")')
  fi
fi

# Compose receipt as a single line. quote string fields, leave numerics bare.
qstr() {
  if [ "$1" = "null" ] || [ -z "$1" ]; then echo "null"; else printf '"%s"' "$1"; fi
}

receipt=$(cat <<EOF
{"workflow":"$workflow","run_id":"$run_id","repo":"$repo","session_id":$(qstr "$session"),"write_mode":$write_mode,"model_actual":$model,"cost_usd":$cost,"input_tokens":$input_tokens,"output_tokens":$output_tokens,"cache_read_input_tokens":$cache_read,"num_turns":$num_turns,"subtype":$subtype,"parsed":$parsed,"execution_file":$(qstr "$exec_file"),"ts":"$ts"}
EOF
)

# Validate it's well-formed JSON before emitting.
if echo "$receipt" | jq . >/dev/null 2>&1; then
  echo "__LLM_RECEIPT__ $receipt"
else
  # Fall back to a minimal but always-valid record.
  echo "__LLM_RECEIPT__ {\"workflow\":\"$workflow\",\"run_id\":\"$run_id\",\"parsed\":false,\"error\":\"malformed receipt\",\"ts\":\"$ts\"}"
fi
