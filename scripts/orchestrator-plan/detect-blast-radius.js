#!/usr/bin/env node
// detect-blast-radius.js — pure deterministic blast-radius detector for
// orchestrator plan-mode. Reads `git diff --numstat <base>` and
// categorizes the change by:
//   1. Path patterns hitting high-risk surfaces (auth, API contract,
//      CI infra, agent system prompts, shared data layer)
//   2. Total LOC threshold (default 200 added/removed)
//
// Outputs structured JSON to stdout. The orchestrator (interactive
// Claude Code subagent) calls this before opening a PR; if blast_radius
// is "high", it pauses, builds a plan, and posts the plan to Jira via
// post-plan.sh for human review.
//
// Usage:
//   node scripts/orchestrator-plan/detect-blast-radius.js [--base main] [--loc-threshold 200]
//
// Exit codes:
//   0 — detection ran (regardless of high vs low)
//   1 — git diff failed (not a git repo, base ref invalid, etc.)

import { execSync } from "node:child_process";

function parseFlag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const BASE = parseFlag("base", "main");
const LOC_THRESHOLD = parseInt(parseFlag("loc-threshold", "200"), 10);

const HIGH_BLAST_PATTERNS = {
  auth: {
    description: "authentication code (login, sessions, password handling)",
    patterns: [
      /^src\/lib\/auth/,
      /^src\/lib\/session/,
      /^src\/app\/api\/auth\//,
    ],
  },
  api_contract: {
    description: "API contract (OpenAPI spec or Postman collection)",
    patterns: [
      /^src\/app\/api\/openapi\//,
      /^mabl\/postman\//,
    ],
  },
  ci_infra: {
    description: "CI infrastructure (workflow YAML or notifier script)",
    patterns: [
      /^\.github\/workflows\//,
      /^scripts\/ci-notify\.sh$/,
      /^scripts\/install-git-hooks\.sh$/,
    ],
  },
  agents: {
    description: "agent system prompts or invocation scripts",
    patterns: [
      /^scripts\/recovery-agent\//,
      /^scripts\/orchestrator-plan\//,
      /^\.claude\/agents\//,
      /^evals\/recovery-agent\//,
    ],
  },
  store: {
    description: "shared data layer (store/seed/types — broad blast radius)",
    patterns: [
      /^src\/lib\/store\.ts$/,
      /^src\/lib\/seed\.ts$/,
      /^src\/lib\/types\.ts$/,
    ],
  },
};

function categorize(path) {
  for (const [cat, def] of Object.entries(HIGH_BLAST_PATTERNS)) {
    if (def.patterns.some((p) => p.test(path))) return cat;
  }
  return "other";
}

let raw;
try {
  raw = execSync(`git diff --numstat ${BASE}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  console.error(`detect-blast-radius: git diff failed: ${e.message}`);
  process.exit(1);
}

const files = raw
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [added, removed, path] = line.split("\t");
    return {
      path,
      added: parseInt(added, 10) || 0,
      removed: parseInt(removed, 10) || 0,
    };
  });

const filesByCategory = {
  auth: [],
  api_contract: [],
  ci_infra: [],
  agents: [],
  store: [],
  other: [],
};

for (const f of files) {
  filesByCategory[categorize(f.path)].push(f.path);
}

const totalLocDelta = files.reduce((acc, f) => acc + f.added + f.removed, 0);
const linesAdded = files.reduce((acc, f) => acc + f.added, 0);
const linesRemoved = files.reduce((acc, f) => acc + f.removed, 0);

const reasons = [];
for (const [cat, def] of Object.entries(HIGH_BLAST_PATTERNS)) {
  const hits = filesByCategory[cat];
  if (hits.length > 0) {
    const fileLabel = hits.length === 1 ? "1 file" : `${hits.length} files`;
    reasons.push(`touches ${cat} (${fileLabel}) — ${def.description}`);
  }
}
if (totalLocDelta > LOC_THRESHOLD) {
  reasons.push(`exceeds ${LOC_THRESHOLD}-LOC threshold (${totalLocDelta} lines added+removed)`);
}

const blastRadius = reasons.length > 0 ? "high" : "low";

const result = {
  blast_radius: blastRadius,
  reasons,
  diff_summary: {
    files_changed: files.length,
    lines_added: linesAdded,
    lines_removed: linesRemoved,
    total_loc_delta: totalLocDelta,
    base_ref: BASE,
    loc_threshold: LOC_THRESHOLD,
  },
  files_by_category: filesByCategory,
};

console.log(JSON.stringify(result, null, 2));
