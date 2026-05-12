#!/usr/bin/env node
// Static contract check on the agentic surface — runs on every PR so the
// hardening can't silently regress.
//
// What this asserts (and why each one matters):
//
//   1. claude.yml / claude-agentic-dod.yml use a SHA-pinned action reference
//      (40-char hex), not a floating @beta or @v1 tag. Floating tags break
//      reproducibility and let the action's behavior shift under our feet.
//
//   2. Every LLM invocation passes --model with an explicit pinned model ID.
//      No -latest, no missing flag.
//
//   3. claude.yml's READ_ONLY_TOOLS env var contains none of the forbidden
//      "side-effect" tools — no Edit/Write, no mcp__*__create_*, no Bash
//      without arg restriction, no run_mabl_test_cloud.
//
//   4. claude-agentic-dod.yml's DOD_ANALYSIS_TOOLS env var likewise.
//
//   5. claude.yml's authorize job gates on author_association ∈
//      {OWNER, MEMBER, COLLABORATOR} — the abuse mitigation for the
//      public-repo @claude trigger.
//
//   6. claude-agentic-dod.yml restricts to same-repo PRs (no fork heads).
//
// Exit code: 0 = clean, 1 = at least one violation. Run from repo root.

import { readFile } from "node:fs/promises";

const failures = [];
const fail = (msg) => failures.push(msg);

const PINNED_SHA_RE = /@[0-9a-f]{40}\b/;
// --model accepts either a literal model ID OR an env interpolation that
// resolves to one — both are checked.
const PINNED_MODEL_FLAG_RE = /--model\s+(?:claude-[a-z]+-\d+-\d+|\$\{\{\s*env\.CLAUDE_MODEL\s*\}\})/;
const PINNED_MODEL_ENV_RE = /CLAUDE_MODEL:\s*claude-[a-z]+-\d+-\d+/;
const FORBIDDEN_IN_READ_ONLY = [
  /\bEdit\b/,
  /\bWrite\b/,
  /mcp__mabl__create_/,
  /mcp__mabl__run_mabl_test_cloud/,
  /mcp__mabl__plan_new_test/,
  /mcp__atlassian__create_/,
  /mcp__atlassian__add_jira_comment/,
  /mcp__atlassian__update_/,
  /Bash(?!\()/,  // bare "Bash" (no paren-arg restriction)
];

async function loadFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    fail(`could not read ${path}: ${e.message}`);
    return "";
  }
}

function assert(condition, msg) {
  if (!condition) fail(msg);
}

function checkForbidden(label, value, forbidden) {
  if (!value) {
    fail(`${label}: env var not found`);
    return;
  }
  for (const re of forbidden) {
    if (re.test(value)) {
      fail(`${label} contains forbidden pattern ${re} — value="${value.slice(0, 200)}…"`);
    }
  }
}

const claudeYml = await loadFile(".github/workflows/claude.yml");
const dodYml = await loadFile(".github/workflows/claude-agentic-dod.yml");

// --- 1. Action SHA pinning ---------------------------------------------------
const claudeActionLine = claudeYml.match(/uses:\s*anthropics\/claude-code-action@\S+/);
const dodActionLine = dodYml.match(/uses:\s*anthropics\/claude-code-action@\S+/);
assert(claudeActionLine, "claude.yml: no anthropics/claude-code-action reference");
assert(dodActionLine, "claude-agentic-dod.yml: no anthropics/claude-code-action reference");
if (claudeActionLine) {
  assert(
    PINNED_SHA_RE.test(claudeActionLine[0]),
    `claude.yml: action ref must be a 40-char SHA, got "${claudeActionLine[0]}"`
  );
}
if (dodActionLine) {
  assert(
    PINNED_SHA_RE.test(dodActionLine[0]),
    `claude-agentic-dod.yml: action ref must be a 40-char SHA, got "${dodActionLine[0]}"`
  );
}

// --- 2. Model pinning -------------------------------------------------------
// Both layers checked: the env CLAUDE_MODEL value is a pinned ID, AND
// --model is actually used in claude_args (otherwise the env is decorative).
assert(
  PINNED_MODEL_ENV_RE.test(claudeYml),
  "claude.yml: env.CLAUDE_MODEL must be a pinned model ID like claude-opus-4-7 (no -latest)"
);
assert(
  PINNED_MODEL_FLAG_RE.test(claudeYml),
  "claude.yml: --model flag missing from claude_args"
);
assert(
  PINNED_MODEL_ENV_RE.test(dodYml),
  "claude-agentic-dod.yml: env.CLAUDE_MODEL must be a pinned model ID"
);
assert(
  PINNED_MODEL_FLAG_RE.test(dodYml),
  "claude-agentic-dod.yml: --model flag missing from claude_args"
);
// "-latest" check scoped to model context only, to avoid matching
// `runs-on: ubuntu-latest`.
const MODEL_LATEST_RE = /claude-[a-z-]+-latest|--model[^\n]+latest/;
assert(
  !MODEL_LATEST_RE.test(claudeYml),
  "claude.yml: -latest model alias detected near --model"
);
assert(
  !MODEL_LATEST_RE.test(dodYml),
  "claude-agentic-dod.yml: -latest model alias detected near --model"
);
// Action ref must not use floating tags. Check the action line specifically
// rather than the whole file (the README/comments may legitimately mention
// "@beta" historically).
const actionFloatRe = /anthropics\/claude-code-action@(latest|beta|v\d+\b)/;
assert(
  !actionFloatRe.test(claudeYml),
  "claude.yml: action ref uses a floating tag (@latest/@beta/@v1)"
);
assert(
  !actionFloatRe.test(dodYml),
  "claude-agentic-dod.yml: action ref uses a floating tag"
);

// --- 3. READ_ONLY_TOOLS forbidden patterns ----------------------------------
const readOnlyMatch = claudeYml.match(/READ_ONLY_TOOLS:\s*"([^"]+)"/);
checkForbidden(
  "claude.yml READ_ONLY_TOOLS",
  readOnlyMatch?.[1],
  FORBIDDEN_IN_READ_ONLY
);

// --- 4. DOD_ANALYSIS_TOOLS forbidden patterns -------------------------------
const dodToolsMatch = dodYml.match(/DOD_ANALYSIS_TOOLS:\s*"([^"]+)"/);
checkForbidden(
  "claude-agentic-dod.yml DOD_ANALYSIS_TOOLS",
  dodToolsMatch?.[1],
  FORBIDDEN_IN_READ_ONLY
);

// --- 5. Author allowlist on @claude -----------------------------------------
assert(
  /author_association/.test(claudeYml),
  "claude.yml: missing author_association gate (the public-repo abuse mitigation)"
);
assert(
  /\bOWNER\b/.test(claudeYml) &&
    /\bMEMBER\b/.test(claudeYml) &&
    /\bCOLLABORATOR\b/.test(claudeYml),
  "claude.yml: author_association allowlist must include OWNER, MEMBER, and COLLABORATOR"
);
assert(
  /\/claude write/.test(claudeYml),
  "claude.yml: write-mode escalation phrase '/claude write' not found"
);

// --- 6. DoD same-repo PRs only ---------------------------------------------
assert(
  /github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository/.test(dodYml),
  "claude-agentic-dod.yml: missing fork-PR exclusion (head.repo.full_name == github.repository)"
);

// --- Report -----------------------------------------------------------------
if (failures.length > 0) {
  console.error(`✗ tool-surface check FAILED — ${failures.length} violation(s):\n`);
  for (const f of failures) console.error(`  • ${f}`);
  console.error("\nIf you intentionally widened the agentic surface, update this script ");
  console.error("alongside the workflow change so the contract stays explicit.");
  process.exit(1);
}

console.log("✓ tool-surface check passed");
console.log("  • action SHA-pinned in claude.yml and claude-agentic-dod.yml");
console.log("  • --model flag present and looks pinned");
console.log("  • READ_ONLY_TOOLS and DOD_ANALYSIS_TOOLS free of side-effect tools");
console.log("  • author_association gate present with OWNER/MEMBER/COLLABORATOR");
console.log("  • DoD restricted to same-repo PRs");
