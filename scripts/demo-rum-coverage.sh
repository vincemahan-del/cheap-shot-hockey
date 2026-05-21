#!/usr/bin/env bash
# demo-rum-coverage.sh — one-command POC runner.
#
# Two modes:
#   mock (default, recommended for demos) — uses scripts/generate-rum-mock.mjs.
#         Instant, deterministic, curated to surface interesting gaps.
#   live — uses scripts/loadgen-rum.mjs (Playwright against prod).
#          Takes ~3 min. Drives real HTTP traffic, but Vercel bot filter
#          usually catches it, so the dashboard rarely populates.
#
# Both write /tmp/loadgen-journeys.json — the agent doesn't care which.
#
# Usage:
#   ./scripts/demo-rum-coverage.sh                       # mock, default 150 sessions
#   ./scripts/demo-rum-coverage.sh --scenario gap-heavy  # bias toward uncovered journeys
#   ./scripts/demo-rum-coverage.sh --live                # use Playwright loadgen instead
#   ./scripts/demo-rum-coverage.sh --live --sessions 30  # 30 live sessions
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

MODE="mock"
PASS_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--live" ]; then
    MODE="live"
  else
    PASS_ARGS+=("$arg")
  fi
done

echo "🏒 RUM coverage POC"
echo ""
echo "Stage 1 — Journey data ($MODE mode)"
echo "─────────────────────────────────"
if [ "$MODE" = "mock" ]; then
  node scripts/generate-rum-mock.mjs "${PASS_ARGS[@]}"
else
  node scripts/loadgen-rum.mjs "${PASS_ARGS[@]}"
fi

echo ""
echo "Stage 2 — Analyzer (manual)"
echo "─────────────────────────"
echo "Run this in Claude Code to read the loadgen log + mabl inventory:"
echo ""
echo "    claude"
echo ""
echo "Then paste:"
echo ""
echo "    Use the rum-coverage-analyzer subagent to analyze the"
echo "    latest loadgen run at /tmp/loadgen-journeys.json. Output"
echo "    a coverage gap report ranked by session count."
echo ""
echo "The analyzer will read both data sources and produce a structured"
echo "markdown report. See docs/RUM-COVERAGE-POC.md for context."
