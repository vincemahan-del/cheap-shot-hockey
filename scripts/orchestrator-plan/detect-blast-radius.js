#!/usr/bin/env node
// detect-blast-radius.js — pure deterministic blast-radius detector for
// orchestrator plan-mode. Reads `git diff --numstat <base>` and a
// (optional) orchestrator-supplied intent.json, then categorizes the
// change by:
//
//   PATH-BASED SIGNALS (deterministic, from diff alone)
//     1. High-risk path patterns (auth, API contract, CI infra, agent
//        system prompts, shared data layer)
//     2. Total LOC threshold (default 200 added/removed)
//
//   BREAKING-CHANGE SIGNALS (deterministic, from diff parsing)
//     3. Removed exports in TS/TSX (potential breaking change for
//        downstream consumers)
//     4. Wide scope — > 5 distinct files modified
//     5. New dependency added in package.json
//
//   ORCHESTRATOR-REPORTED SIGNALS (from intent.json)
//     6. Open questions count > 0
//     7. is_workaround === true
//     8. adds_abstraction === true
//     9. architectural_review_requested === true
//
// Outputs structured JSON to stdout. The orchestrator (interactive
// Claude Code subagent) calls this before opening a PR; if blast_radius
// is "high", it pauses, builds a plan, and posts the plan to Jira via
// post-plan.sh for human review.
//
// Usage:
//   node scripts/orchestrator-plan/detect-blast-radius.js [--base main] [--loc-threshold 200] [--intent ./intent.json] [--scope-threshold 5]
//
// Exit codes:
//   0 — detection ran (regardless of high vs low)
//   1 — git diff failed (not a git repo, base ref invalid, etc.)

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

function parseFlag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const BASE = parseFlag("base", "main");
const LOC_THRESHOLD = parseInt(parseFlag("loc-threshold", "200"), 10);
const SCOPE_THRESHOLD = parseInt(parseFlag("scope-threshold", "5"), 10);
const INTENT_PATH = parseFlag("intent", "./intent.json");

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

// Mapping of changed file paths → mabl test `area-*` labels. Used by the
// tier-4 routing layer (see `.github/workflows/mabl-sdlc.yml` job
// `mabl-cli-pr-regression`) to filter regression-tier mabl tests to only
// the areas a PR actually touched. A file can contribute to multiple
// areas (e.g. `src/lib/store.ts` is referenced by both catalog and
// checkout flows). The detector outputs the unique set of touched areas
// as `touched_mabl_areas` in its JSON output.
//
// Customers forking this pattern: edit these regexes to match their
// codebase's risk surfaces, then label their mabl tests with `area-<X>`
// to match.
const MABL_AREA_PATTERNS = {
  auth: [
    /^src\/lib\/auth/,
    /^src\/lib\/session/,
    /^src\/app\/api\/auth\//,
    /^src\/app\/login\//,
    /^src\/app\/register\//,
    /^src\/app\/account\//,
  ],
  checkout: [
    /^src\/app\/checkout\//,
    /^src\/app\/cart\//,
    /^src\/app\/orders\//,
    /^src\/app\/api\/orders\//,
    /^src\/lib\/cart-cookie/,
    /^src\/lib\/order-cookie/,
  ],
  catalog: [
    /^src\/app\/page\.tsx$/,
    /^src\/app\/products\//,
    /^src\/app\/api\/products\//,
    /^src\/lib\/seed/,
    /^src\/lib\/store/,
    /^src\/components\/ProductCard/,
    /^src\/components\/CategoryTile/,
    /^src\/components\/BrandRow/,
  ],
};

function categorize(path) {
  for (const [cat, def] of Object.entries(HIGH_BLAST_PATTERNS)) {
    if (def.patterns.some((p) => p.test(path))) return cat;
  }
  return "other";
}

// A file can map to MULTIPLE mabl areas (e.g., src/lib/store.ts is
// referenced by both catalog and checkout flows). Returns a sorted
// unique array of area names. Always sorted for deterministic output.
function computeTouchedMablAreas(filePaths) {
  const areas = new Set();
  for (const path of filePaths) {
    for (const [area, patterns] of Object.entries(MABL_AREA_PATTERNS)) {
      if (patterns.some((p) => p.test(path))) {
        areas.add(area);
      }
    }
  }
  return [...areas].sort();
}

// ── Diff numstat (file list + LOC counts) ────────────────────────
let numstat;
try {
  numstat = execSync(`git diff --numstat ${BASE}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  console.error(`detect-blast-radius: git diff --numstat failed: ${e.message}`);
  process.exit(1);
}

const files = numstat
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

// ── Full diff (for breaking-change signal extraction) ────────────
let fullDiff = "";
try {
  fullDiff = execSync(`git diff ${BASE}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 50 * 1024 * 1024,
  });
} catch (e) {
  // Non-fatal: detector still works without full diff, just with less detail
  console.error(`detect-blast-radius: git diff (full) failed; breaking-change detection skipped: ${e.message}`);
}

// ── Breaking-change signal: removed exports in TS/TSX ─────────────
// Look for `-export <function|const|class|default|interface|type|enum>`
// patterns in the diff. Only counts removals, not modifications, to
// avoid false positives on signature tweaks (sig changes need AST
// parsing — out of scope for v1).
const REMOVED_EXPORT_RE = /^-export\s+(default\s+)?(async\s+)?(function|const|let|var|class|interface|type|enum)\s+\w+/m;

let removedExportLines = 0;
if (fullDiff) {
  // Split by file headers ("diff --git a/... b/..."). Only scan TS/TSX files.
  const fileBlocks = fullDiff.split(/^diff --git /m).slice(1);
  for (const block of fileBlocks) {
    const firstLine = block.split("\n")[0]; // "a/path b/path"
    if (!/\.tsx?\s+b\//.test(firstLine)) continue;
    for (const line of block.split("\n")) {
      if (REMOVED_EXPORT_RE.test(line)) removedExportLines += 1;
    }
  }
}

// ── Breaking-change signal: new dependency in package.json ────────
let newDependencyCount = 0;
let newDependencyNames = [];
if (fullDiff) {
  // Extract just the package.json portion of the diff
  const pkgBlockMatch = fullDiff.match(
    /^diff --git a\/package\.json b\/package\.json[\s\S]*?(?=^diff --git |\Z)/m,
  );
  if (pkgBlockMatch) {
    const pkgBlock = pkgBlockMatch[0];
    let inDepsSection = false;
    for (const line of pkgBlock.split("\n")) {
      // Track section: "dependencies" / "devDependencies" / "peerDependencies"
      const sectionMatch = line.match(/^[+\- ]\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:/);
      if (sectionMatch) {
        inDepsSection = true;
        continue;
      }
      // Section close: a "}" at the same indent level
      if (inDepsSection && /^[+\- ]\s*\},?\s*$/.test(line)) {
        inDepsSection = false;
        continue;
      }
      // Added line in deps section: starts with "+" and matches "name": "version"
      if (inDepsSection && /^\+\s*"([^"]+)":\s*"[^"]+"/.test(line)) {
        const m = line.match(/^\+\s*"([^"]+)":/);
        if (m) {
          newDependencyCount += 1;
          newDependencyNames.push(m[1]);
        }
      }
    }
  }
}

// ── Orchestrator-reported signals: intent.json ────────────────────
let intent = null;
let intentError = null;
if (existsSync(INTENT_PATH)) {
  try {
    const raw = readFileSync(INTENT_PATH, "utf8");
    intent = JSON.parse(raw);
  } catch (e) {
    intentError = `failed to parse ${INTENT_PATH}: ${e.message}`;
  }
}

// Normalize intent fields with safe defaults
const intentSummary = {
  open_questions_count: Array.isArray(intent?.open_questions) ? intent.open_questions.length : 0,
  is_workaround: intent?.is_workaround === true,
  workaround_reason: intent?.workaround_reason || null,
  adds_abstraction: intent?.adds_abstraction === true,
  introduces_new_dependency: intent?.introduces_new_dependency === true,
  architectural_review_requested: intent?.architectural_review_requested === true,
  intent_file_path: existsSync(INTENT_PATH) ? INTENT_PATH : null,
  parse_error: intentError,
};

// ── Compose all reasons ───────────────────────────────────────────
const reasons = [];

// Path-based
for (const [cat, def] of Object.entries(HIGH_BLAST_PATTERNS)) {
  const hits = filesByCategory[cat];
  if (hits.length > 0) {
    const fileLabel = hits.length === 1 ? "1 file" : `${hits.length} files`;
    reasons.push(`touches ${cat} (${fileLabel}) — ${def.description}`);
  }
}

// LOC threshold
if (totalLocDelta > LOC_THRESHOLD) {
  reasons.push(`exceeds ${LOC_THRESHOLD}-LOC threshold (${totalLocDelta} lines added+removed)`);
}

// Wide scope
if (files.length > SCOPE_THRESHOLD) {
  reasons.push(`wide scope — ${files.length} distinct files modified (threshold: ${SCOPE_THRESHOLD})`);
}

// Removed exports
if (removedExportLines > 0) {
  const exportLabel = removedExportLines === 1 ? "1 export" : `${removedExportLines} exports`;
  reasons.push(`${exportLabel} removed in TS/TSX — potential breaking change for downstream consumers`);
}

// New dependencies
if (newDependencyCount > 0) {
  const depLabel = newDependencyCount === 1 ? "1 new dependency" : `${newDependencyCount} new dependencies`;
  const names = newDependencyNames.slice(0, 3).join(", ");
  reasons.push(`${depLabel} added in package.json (${names}${newDependencyNames.length > 3 ? ", …" : ""})`);
}

// Orchestrator signals
if (intentSummary.open_questions_count > 0) {
  const qLabel = intentSummary.open_questions_count === 1 ? "1 open question" : `${intentSummary.open_questions_count} open questions`;
  reasons.push(`${qLabel} flagged by orchestrator — needs human resolution before merge`);
}
if (intentSummary.is_workaround) {
  const reason = intentSummary.workaround_reason ? ` (${intentSummary.workaround_reason})` : "";
  reasons.push(`marked as workaround / defensive fix${reason} — proper fix should follow`);
}
if (intentSummary.adds_abstraction) {
  reasons.push("adds new abstraction or refactors > 1 module — architectural review recommended");
}
if (intentSummary.architectural_review_requested) {
  reasons.push("orchestrator self-flagged architectural review needed");
}
if (intentSummary.parse_error) {
  reasons.push(`intent.json parse error — defaulting to high blast radius for safety: ${intentSummary.parse_error}`);
}

const blastRadius = reasons.length > 0 ? "high" : "low";

// Tier-4 routing: which mabl `area-*` labels should the regression
// dispatcher filter on? Computed independently of blast-radius — a PR
// can be "low blast" but still touch one or more areas (typo in
// checkout copy → area-checkout). The PR-time CLI regression job runs
// for every touched area regardless of blast. Cloud regression only
// fires for high-blast PRs.
const touchedMablAreas = computeTouchedMablAreas(files.map((f) => f.path));

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
    scope_threshold: SCOPE_THRESHOLD,
  },
  files_by_category: filesByCategory,
  touched_mabl_areas: touchedMablAreas,
  breaking_change_signals: {
    removed_exports: removedExportLines,
    wide_scope: files.length > SCOPE_THRESHOLD,
    new_dependencies: newDependencyCount,
    new_dependency_names: newDependencyNames,
  },
  orchestrator_signals: intentSummary,
};

console.log(JSON.stringify(result, null, 2));
