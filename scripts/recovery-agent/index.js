#!/usr/bin/env node
// Failure-recovery diagnosis agent (narrow). Reads pre-fetched context
// from ./logs/ and emits a structured JSON recommendation. Takes no
// actions on shared infrastructure — a deterministic wrapper script
// (recommend.sh) posts the recommendation to Slack and Jira.
//
// Inputs (env):
//   ANTHROPIC_API_KEY  — required; agent skips with noop if missing
//   RECOVERY_RESULT_FILE  — output JSON path (default: ./recovery-result.json)
//   LOGS_DIR  — pre-fetched context directory (default: ./logs)
//   TICKET_KEY, GITHUB_SHA, GITHUB_RUN_ID  — included in the prompt for
//     traceability; the agent doesn't fetch them, only references them
//
// Tools available to the agent: Read, Grep, Glob (no Bash, no Edit, no Write).
// Permission mode: default (read-only tools won't trigger prompts anyway).

import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RESULT_FILE = process.env.RECOVERY_RESULT_FILE || "./recovery-result.json";
const LOGS_DIR = process.env.LOGS_DIR || "./logs";
const HARD_TIMEOUT_MS = 5 * 60 * 1000;

const failsafe = (reason) => ({
  decision: "page-human",
  confidence: "low",
  reasoning: reason,
  suggested_revert_sha: null,
  suggested_fix_summary: null,
  looks_like_flake: false,
  looks_like_demo_toggle: false,
});

async function writeResult(obj) {
  await writeFile(RESULT_FILE, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log(`[recovery-agent] wrote ${RESULT_FILE}: ${obj.decision} (${obj.confidence})`);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("[recovery-agent] ANTHROPIC_API_KEY not set — emitting page-human noop.");
  await writeResult(
    failsafe("ANTHROPIC_API_KEY is not configured in repo secrets; agent did not run.")
  );
  process.exit(0);
}

const systemPrompt = await readFile(join(__dirname, "system-prompt.md"), "utf8");

const ctx = {
  ticket: process.env.TICKET_KEY || "unknown",
  sha: process.env.GITHUB_SHA || "unknown",
  shaShort: (process.env.GITHUB_SHA || "").slice(0, 7),
  runId: process.env.GITHUB_RUN_ID || "unknown",
  failedStage: process.env.FAILED_STAGE || "post-deploy-smoke",
  logsDir: LOGS_DIR,
};

const prompt = `Production-deploy verification failed. Diagnose using the pre-fetched context in ${ctx.logsDir}/ and emit a structured JSON recommendation per your system prompt.

Context for traceability (do not refetch — these are facts, not files):
- Ticket: ${ctx.ticket}
- Failed stage: ${ctx.failedStage}
- Main commit at failure: ${ctx.sha} (\`${ctx.shaShort}\`)
- GHA run id: ${ctx.runId}

Begin by globbing ${ctx.logsDir}/ to confirm available evidence, then read gha-run.log first.`;

console.log(`[recovery-agent] starting · ticket=${ctx.ticket} sha=${ctx.shaShort} run=${ctx.runId}`);

const startedAt = Date.now();
let toolUseCount = 0;
const assistantTexts = [];

const timer = setTimeout(async () => {
  console.error("[recovery-agent] HARD TIMEOUT (5 min) — emitting fail-safe page-human.");
  try {
    await writeResult(failsafe("Agent exceeded 5-minute hard timeout."));
  } catch (e) {}
  process.exit(2);
}, HARD_TIMEOUT_MS);

try {
  for await (const message of query({
    prompt,
    options: {
      systemPrompt,
      allowedTools: ["Read", "Grep", "Glob"],
      permissionMode: "default",
      cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
    },
  })) {
    const t = message?.type;
    if (t === "assistant" || t === "user") {
      const blocks = message?.message?.content ?? [];
      for (const b of blocks) {
        if (b?.type === "text" && b.text) {
          if (t === "assistant") assistantTexts.push(b.text);
          console.log(`[recovery-agent] ${t}:`, b.text.slice(0, 500));
        } else if (b?.type === "tool_use") {
          toolUseCount += 1;
          console.log(`[recovery-agent] tool_use: ${b.name}`);
        } else if (b?.type === "tool_result") {
          const out = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
          console.log(`[recovery-agent] tool_result (${out.length}B)`);
        }
      }
    } else if (t === "result") {
      console.log(`[recovery-agent] sdk result message`);
    }
  }
} catch (err) {
  clearTimeout(timer);
  console.error("[recovery-agent] error during query():", err?.message || err);
  await writeResult(failsafe(`Agent SDK error: ${err?.message || String(err)}`));
  process.exit(0); // Don't fail the GHA step — the wrapper still has a result to post.
}

clearTimeout(timer);

const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`[recovery-agent] done in ${durationSec}s · tool_uses=${toolUseCount}`);

// Extract the final JSON block from the last assistant message.
const finalText = assistantTexts[assistantTexts.length - 1] || "";
const jsonMatch = finalText.match(/```json\s*\n([\s\S]*?)\n```\s*$/);

if (!jsonMatch) {
  console.error("[recovery-agent] no fenced JSON block at end of final assistant message.");
  await writeResult(failsafe("Agent did not emit a fenced JSON block in the expected schema."));
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(jsonMatch[1]);
} catch (e) {
  console.error("[recovery-agent] JSON parse error:", e.message);
  await writeResult(failsafe(`Agent JSON was not parseable: ${e.message}`));
  process.exit(0);
}

const requiredKeys = ["decision", "confidence", "reasoning"];
const missing = requiredKeys.filter((k) => !(k in parsed));
if (missing.length > 0) {
  console.error("[recovery-agent] missing required keys:", missing);
  await writeResult(failsafe(`Agent JSON missing required keys: ${missing.join(", ")}`));
  process.exit(0);
}

const validDecisions = ["revert", "forward-fix", "page-human"];
if (!validDecisions.includes(parsed.decision)) {
  console.error("[recovery-agent] invalid decision:", parsed.decision);
  await writeResult(failsafe(`Agent emitted invalid decision: ${parsed.decision}`));
  process.exit(0);
}

const validated = {
  decision: parsed.decision,
  confidence: parsed.confidence || "low",
  reasoning: String(parsed.reasoning || "").slice(0, 1000),
  suggested_revert_sha: parsed.suggested_revert_sha || null,
  suggested_fix_summary: parsed.suggested_fix_summary || null,
  looks_like_flake: Boolean(parsed.looks_like_flake),
  looks_like_demo_toggle: Boolean(parsed.looks_like_demo_toggle),
};

await writeResult(validated);
process.exit(0);
