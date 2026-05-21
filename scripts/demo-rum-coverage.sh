#!/usr/bin/env bash
# demo-rum-coverage.sh — one-command POC runner.
#
# 1. Drives realistic user traffic against prod via Playwright (loadgen)
# 2. Reminds you to invoke the rum-coverage-analyzer subagent in Claude
#
# Usage:
#   ./scripts/demo-rum-coverage.sh                 # default 30 sessions
#   ./scripts/demo-rum-coverage.sh --sessions 50   # more traffic
#   ./scripts/demo-rum-coverage.sh --headed        # show browser windows
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "🏒 RUM coverage POC"
echo ""
echo "Stage 1 — Loadgen"
echo "─────────────────"
node scripts/loadgen-rum.mjs "$@"

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
