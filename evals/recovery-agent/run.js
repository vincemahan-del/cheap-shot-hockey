#!/usr/bin/env node
// Eval runner for the failure-recovery agent.
// Iterates fixtures under ./fixtures/, invokes scripts/recovery-agent/index.js
// against each one with that fixture's logs as the agent's pre-fetched
// context, then scores the agent's output against the fixture's expected.json
// rubric.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node evals/recovery-agent/run.js
//
// Exit code: 0 if all fixtures pass, 1 if any fail. Per-fixture pass/fail
// printed to stdout with a final aggregate score.

import { spawn } from "node:child_process";
import { readFile, readdir, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const FIXTURES_DIR = join(__dirname, "fixtures");
const TMP_DIR = join(__dirname, "tmp");
const AGENT_INDEX = join(REPO_ROOT, "scripts", "recovery-agent", "index.js");

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(c.yellow("[evals] ANTHROPIC_API_KEY not set."));
  console.error(c.yellow("[evals] Cannot run evals without invoking the agent."));
  console.error(c.dim("[evals] Set ANTHROPIC_API_KEY in env and re-run."));
  process.exit(2);
}

await mkdir(TMP_DIR, { recursive: true });

function runAgent(fixtureName) {
  return new Promise((resolve, reject) => {
    const resultFile = join(TMP_DIR, `${fixtureName}-result.json`);
    if (existsSync(resultFile)) {
      // ensure each run writes fresh
      rm(resultFile).catch(() => {});
    }
    const env = {
      ...process.env,
      LOGS_DIR: join(FIXTURES_DIR, fixtureName),
      RECOVERY_RESULT_FILE: resultFile,
      TICKET_KEY: `EVAL-${fixtureName}`,
      GITHUB_SHA: "evalfix0000000000000000000000000000000000",
      GITHUB_RUN_ID: "0",
      GITHUB_REPOSITORY: "evals/recovery-agent",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_EVENT_NAME: "push",
      FAILED_STAGE: "post-deploy-smoke",
      PROD_URL: "https://example.com",
    };
    const proc = spawn("node", [AGENT_INDEX], {
      env,
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", async (code) => {
      try {
        const raw = await readFile(resultFile, "utf8");
        const parsed = JSON.parse(raw);
        resolve({ result: parsed, exitCode: code, stdout, stderr });
      } catch (e) {
        reject(new Error(`Failed to read/parse ${resultFile}: ${e.message}\nstderr:\n${stderr.slice(-500)}`));
      }
    });
    proc.on("error", (e) => reject(e));
  });
}

function scoreOne(actual, expected) {
  const failures = [];
  const r = expected.rubric;

  if (actual.decision !== r.decision) {
    failures.push(`decision: expected "${r.decision}", got "${actual.decision}"`);
  }

  if (Array.isArray(r.confidence_acceptable) && !r.confidence_acceptable.includes(actual.confidence)) {
    failures.push(`confidence: "${actual.confidence}" not in [${r.confidence_acceptable.join(", ")}]`);
  }

  if (typeof r.looks_like_flake === "boolean" && actual.looks_like_flake !== r.looks_like_flake) {
    failures.push(`looks_like_flake: expected ${r.looks_like_flake}, got ${actual.looks_like_flake}`);
  }

  if (typeof r.looks_like_demo_toggle === "boolean" && actual.looks_like_demo_toggle !== r.looks_like_demo_toggle) {
    failures.push(`looks_like_demo_toggle: expected ${r.looks_like_demo_toggle}, got ${actual.looks_like_demo_toggle}`);
  }

  if (r.suggested_revert_sha_required && !actual.suggested_revert_sha) {
    failures.push(`suggested_revert_sha required but null`);
  }
  if (r.suggested_revert_sha_must_match && actual.suggested_revert_sha) {
    const expectedShortSha = r.suggested_revert_sha_must_match.slice(0, 7);
    const actualShortSha = String(actual.suggested_revert_sha).slice(0, 7);
    if (expectedShortSha !== actualShortSha) {
      failures.push(`suggested_revert_sha: expected ~"${expectedShortSha}", got "${actualShortSha}"`);
    }
  }

  if (r.suggested_fix_summary_required && !actual.suggested_fix_summary) {
    failures.push(`suggested_fix_summary required but null`);
  }

  if (Array.isArray(r.reasoning_must_mention_any_of)) {
    const reasoning = String(actual.reasoning || "").toLowerCase();
    const matched = r.reasoning_must_mention_any_of.some((kw) =>
      reasoning.includes(String(kw).toLowerCase())
    );
    if (!matched) {
      failures.push(`reasoning missing all of: [${r.reasoning_must_mention_any_of.join(", ")}]`);
    }
  }

  return { passed: failures.length === 0, failures };
}

async function main() {
  console.log(c.bold(c.cyan("\n=== Recovery-agent eval harness ===\n")));

  const fixtureNames = (await readdir(FIXTURES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const results = [];
  for (const name of fixtureNames) {
    const expectedPath = join(FIXTURES_DIR, name, "expected.json");
    const expected = JSON.parse(await readFile(expectedPath, "utf8"));

    process.stdout.write(c.dim(`  → running fixture "${name}"... `));
    const startedAt = Date.now();
    let agentRun;
    try {
      agentRun = await runAgent(name);
    } catch (e) {
      console.log(c.red(`ERROR`));
      console.log(c.red(`    ${e.message}`));
      results.push({ name, passed: false, failures: [`agent invocation error: ${e.message}`], duration_ms: Date.now() - startedAt });
      continue;
    }
    const durationMs = Date.now() - startedAt;
    const score = scoreOne(agentRun.result, expected);
    if (score.passed) {
      console.log(c.green(`PASS`) + c.dim(` (${(durationMs / 1000).toFixed(1)}s)`));
    } else {
      console.log(c.red(`FAIL`) + c.dim(` (${(durationMs / 1000).toFixed(1)}s)`));
      score.failures.forEach((f) => console.log(c.red(`      • ${f}`)));
      console.log(c.dim(`      actual decision: "${agentRun.result.decision}" · confidence: "${agentRun.result.confidence}"`));
      console.log(c.dim(`      actual reasoning: "${String(agentRun.result.reasoning || "").slice(0, 160)}..."`));
    }
    results.push({ name, ...score, duration_ms: durationMs });
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const pct = total > 0 ? ((passed / total) * 100).toFixed(0) : 0;
  const totalDurationSec = (results.reduce((acc, r) => acc + r.duration_ms, 0) / 1000).toFixed(1);

  console.log("");
  console.log(c.bold(`  Score: ${passed}/${total} (${pct}%) · total ${totalDurationSec}s`));

  if (passed === total) {
    console.log(c.green(c.bold("  ✓ all fixtures passed\n")));
    process.exit(0);
  } else {
    console.log(c.red(c.bold(`  ✗ ${total - passed} fixture(s) failed\n`)));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(c.red(`[evals] runner error: ${e.message}`));
  console.error(e.stack);
  process.exit(2);
});
