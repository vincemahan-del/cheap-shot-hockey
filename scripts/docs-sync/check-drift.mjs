#!/usr/bin/env node
// check-drift.mjs — deterministic docs/reality drift checks (TAMD-130).
//
// Four checks run unconditionally:
//   1. docs/MERGE-POLICY.md required-check table vs live branch protection
//   2. Workflow job-name index (informational; doc-citation cross-check
//      is too noisy to enforce in v1 — left as a future tightening point)
//   3. Per-doc last-verified staleness (>= 90 days AND tracked files
//      changed in the meantime)
//   4. Enforcement file changed in this PR diff without doc touch
//
// Output: advisory markdown to stdout. Exit always 0. The PR comment is
// the surface — see .github/workflows/docs-drift-guardian.yml.
//
// Usage:
//   node scripts/docs-sync/check-drift.mjs [--base-ref <sha>] [--head-ref <sha>]
//
// Env:
//   GITHUB_REPOSITORY (optional) — "owner/repo". Auto-detected from git
//                                  remote if not set.
//   GH_TOKEN / GITHUB_TOKEN     — used by `gh api` calls below.

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Setup ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
    args[argv[i].slice(2)] = argv[i + 1];
    i++;
  }
}
const BASE_REF = args["base-ref"] || "main";
const HEAD_REF = args["head-ref"] || "HEAD";
const STALE_DAYS = Number(process.env.STALE_DAYS) || 90;

// Docs that make verifiable claims about repo enforcement. Other docs
// (prompt templates, test catalogs) opt out.
const TRACKED_DOCS = [
  "CLAUDE.md",
  "AGENTS.md",
  "README.md",
  "docs/MERGE-POLICY.md",
  "docs/REFERENCE-ARCHITECTURE.md",
  "docs/SDLC-DEMO.md",
  "docs/AGENTIC-SHIFT-LEFT.md",
  "docs/FORK-GUIDE.md",
  "docs/LOCAL-GATE.md",
  "docs/MCP-NARRATION-PLAYBOOK.md",
  "docs/SLACK-JIRA-NOTIFICATIONS.md",
  "docs/DEMO-SETUP-VSCODE.md",
];

// Files whose changes should prompt a doc review.
const ENFORCEMENT_PREFIXES = [
  ".github/workflows/",
  "scripts/orchestrator-plan/",
  "scripts/llm/",
];
const ENFORCEMENT_EXACT = new Set([
  ".github/dependabot.yml",
  "vitest.config.ts",
  "eslint.config.mjs",
  "tsconfig.json",
  "Jenkinsfile",
  "scripts/ci-notify.sh",
  "scripts/mabl-deployment.sh",
  "scripts/mabl-local-gate.sh",
  "scripts/mabl-local-cli.sh",
]);

// ─── Finding collector ──────────────────────────────────────────────
// Signal levels (TAMD-135):
//   🚨 drift  — high-signal: real divergence between docs and reality
//               (only checks 1 + 3 emit these; Slack fires on these).
//   🕒 stale  — high-signal: tracked docs past their staleness budget
//               while the files they verify have moved. Slack fires.
//   ⚠️ warn   — low-signal: heuristic nudge, false-positive rate > 0.
//               Appears in the PR comment, does NOT fire Slack.
//   ℹ️ info   — informational: a check couldn't run (permissions,
//               missing file, parse error). Not drift evidence.
//   ✅ ok     — clean.
const findings = [];
const note = (icon, msg) => findings.push(`${icon} ${msg}`);
const ok = (msg) => note("✅", msg);
const drift = (msg) => note("🚨", msg);
const warn = (msg) => note("⚠️", msg);
const stale = (msg) => note("🕒", msg);
const info = (msg) => note("ℹ️", msg);

// ─── Helpers ────────────────────────────────────────────────────────
function getRepoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execSync("git remote get-url origin", { encoding: "utf8" }).trim();
    const m = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1];
  } catch {
    /* fall through */
  }
  return null;
}

function readRepoFile(path) {
  try {
    return readFileSync(join(REPO_ROOT, path), "utf8");
  } catch {
    return null;
  }
}

function changedFiles() {
  try {
    return execSync(`git diff --name-only ${BASE_REF}...${HEAD_REF}`, {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch (e) {
    warn(`Could not diff \`${BASE_REF}...${HEAD_REF}\`: ${e.message.split("\n")[0]}`);
    return [];
  }
}

function fileChangedSince(file, sinceISODate) {
  try {
    const out = execSync(
      `git log --since="${sinceISODate}" --format=%H -- "${file}"`,
      { encoding: "utf8" }
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function isEnforcementPath(p) {
  if (ENFORCEMENT_EXACT.has(p)) return true;
  return ENFORCEMENT_PREFIXES.some((prefix) => p.startsWith(prefix));
}

// ─── Check 1: MERGE-POLICY vs live branch protection ───────────────
function checkPolicyVsBranchProtection() {
  const repo = getRepoSlug();
  if (!repo) {
    // Can't validate — not drift evidence.
    info("Skipping branch-protection check: cannot determine repo slug.");
    return;
  }
  let liveChecks;
  try {
    const liveJson = execSync(`gh api repos/${repo}/branches/main/protection`, {
      encoding: "utf8",
    });
    const live = JSON.parse(liveJson);
    liveChecks = new Set(live.required_status_checks?.contexts || []);
  } catch (e) {
    // Almost always a token-scope issue (HTTP 403 from GITHUB_TOKEN
    // without `administration: read`). The check didn't run, so we have
    // no evidence either way — not drift.
    info(`Could not query branch protection: ${e.message.split("\n")[0]}`);
    return;
  }

  const policy = readRepoFile("docs/MERGE-POLICY.md");
  if (!policy) {
    warn("`docs/MERGE-POLICY.md` not found — cannot compare to branch protection.");
    return;
  }

  // Parse the Required checks table. Section is bounded by "## Required
  // checks" above and "## Advisory" below. Pull backticked names from
  // the first column of each row.
  const reqSectionMatch = policy.match(
    /## Required checks[\s\S]*?(?=## Advisory|## Why)/
  );
  if (!reqSectionMatch) {
    // Doc exists but we couldn't parse the section — not drift evidence
    // about checks; just a parse failure to surface for a human to look at.
    info("Could not locate the 'Required checks' section in `docs/MERGE-POLICY.md`.");
    return;
  }
  const policyChecks = new Set(
    [...reqSectionMatch[0].matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1])
  );

  let diverged = false;
  for (const c of liveChecks) {
    if (!policyChecks.has(c)) {
      // Real divergence: high-signal drift.
      drift(
        `Branch protection requires \`${c}\` but \`docs/MERGE-POLICY.md\` doesn't list it.`
      );
      diverged = true;
    }
  }
  for (const c of policyChecks) {
    if (!liveChecks.has(c)) {
      // Real divergence: high-signal drift.
      drift(
        `\`docs/MERGE-POLICY.md\` lists \`${c}\` as required, but branch protection doesn't enforce it.`
      );
      diverged = true;
    }
  }
  if (!diverged) {
    ok(
      `\`docs/MERGE-POLICY.md\` required-check list matches live branch protection (${liveChecks.size} checks).`
    );
  }
}

// ─── Check 2: Workflow job-name index (informational) ──────────────
function checkWorkflowJobIndex() {
  const wfDir = join(REPO_ROOT, ".github/workflows");
  if (!existsSync(wfDir)) return;
  const realJobNames = new Set();
  let wfCount = 0;
  for (const f of readdirSync(wfDir).filter((f) => f.endsWith(".yml"))) {
    wfCount++;
    const body = readFileSync(join(wfDir, f), "utf8");
    for (const m of body.matchAll(/^\s+name:\s+(.+)$/gm)) {
      realJobNames.add(m[1].trim().replace(/['"]/g, ""));
    }
  }
  ok(
    `Workflow job-name index loaded: ${realJobNames.size} names across ${wfCount} workflow files. (Doc-citation cross-check is informational in v1.)`
  );
}

// ─── Check 3: Per-doc last-verified staleness ──────────────────────
function checkStaleness() {
  let staleCount = 0;
  let missingCount = 0;
  for (const path of TRACKED_DOCS) {
    const body = readRepoFile(path);
    if (!body) continue;
    const m = body.match(/^---\s*\nlast-verified:\s*(\d{4}-\d{2}-\d{2})/m);
    if (!m) {
      warn(`\`${path}\` missing \`last-verified\` front matter.`);
      missingCount++;
      continue;
    }
    const verifiedISO = m[1];
    const verified = new Date(verifiedISO);
    const days = Math.floor((Date.now() - verified.getTime()) / 86400e3);
    if (days < STALE_DAYS) continue;

    // Find verifies: list (YAML inline array form)
    const v = body.match(/^verifies:\s*\[([^\]]*)\]/m);
    const verifies = v
      ? v[1]
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean)
      : [];

    const tracksAnyChange = verifies.some((f) => fileChangedSince(f, verifiedISO));
    if (tracksAnyChange) {
      stale(
        `\`${path}\` last verified ${verifiedISO} (${days} days ago) and at least one tracked file has changed since — please re-verify and bump the date.`
      );
      staleCount++;
    }
  }
  if (staleCount === 0 && missingCount === 0) {
    ok(
      `All ${TRACKED_DOCS.length} tracked docs are fresh (\`last-verified\` within ${STALE_DAYS} days, or no tracked files changed since).`
    );
  }
}

// ─── Check 4: Enforcement file changed without doc touch ───────────
function checkEnforcementWithoutDocs() {
  const changed = changedFiles();
  if (changed.length === 0) return;

  const enforcementChanged = changed.filter(isEnforcementPath);
  const docsChanged = changed.filter((f) => f.endsWith(".md"));

  if (enforcementChanged.length === 0) return;

  if (docsChanged.length === 0) {
    warn(
      `Enforcement file(s) changed but no docs were updated in this PR. Touched: ${enforcementChanged
        .map((f) => `\`${f}\``)
        .join(
          ", "
        )}. Consider whether \`docs/MERGE-POLICY.md\`, \`docs/REFERENCE-ARCHITECTURE.md\`, or \`docs/AGENTIC-SHIFT-LEFT.md\` need updates.`
    );
  } else {
    ok(
      `Enforcement file(s) changed and docs were also updated: ${docsChanged
        .map((f) => `\`${f}\``)
        .join(", ")}.`
    );
  }
}

// ─── Main ───────────────────────────────────────────────────────────
console.log("## Docs–reality drift report");
console.log("");
checkPolicyVsBranchProtection();
checkWorkflowJobIndex();
checkStaleness();
checkEnforcementWithoutDocs();
console.log(findings.length === 0 ? "_No drift detected._" : findings.join("\n"));
console.log("");
console.log("---");
console.log(
  "_Advisory only — never blocks merge. See [`docs/MERGE-POLICY.md`](../docs/MERGE-POLICY.md) for the required-vs-advisory contract._"
);
process.exit(0);
