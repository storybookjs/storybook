// PR Verify Harness — evidence-check step (single-round v6).
//
// After the Playwright recipe lands a `verdict: 'verified'` in result.json,
// this script asks a vision-capable model whether the screenshots produced
// by the recipe actually show the diff's visible effect. The goal is to
// stop "smoke-shaped verified" — a recipe that passed assertions on an
// unrelated story while never exercising the changed UI.
//
// Inputs:
//   --result <path>   verify-result.json (rewritten in-place with evidence fields)
//   --diff   <path>   the PR's unified diff (typically /tmp/pr.diff)
//   --recipe <path>   the authored .spec.ts the runner just executed
//
// Output (writes back to --result):
//   {
//     ...existing verify-result fields...
//     evidenceVerdict: 'found' | 'missing' | 'undetermined',
//     evidenceReasoning: string,
//     evidenceModel: string,
//     notes: string[] (includes an evidence-check note when evidence is missing)
//   }
//
// Exit codes:
//   Always 0. Downstream (workflow step ordering, label gate, retry-loop)
//   reads the rewritten verify-result.json to branch — the script does NOT
//   drive workflow control flow via process exit.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';

import {
  computeRealizedCostUsd,
  recordDispatchCost,
  VerifyCostBudgetError,
} from './verify/agent-dispatch.ts';
import { sanitizeUntrustedText } from './verify/agent-prompt.ts';
import { assertAnthropicBaseUrl } from './verify/anthropic-env.ts';
import { isPng } from './verify/ci/push-screenshots.ts';
import { appendNote, signResultFile, type VerifyResult } from './verify/core.ts';

assertAnthropicBaseUrl();

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const DIFF_TRUNCATE_BYTES = 64 * 1024;
// Realistic per-call budget estimate for the vision check (haiku, 3 images
// at ~256KB each, ~1024 output tokens). Used to gate against
// VERIFY_MAX_COST_USD when prior dispatches have already drained the run.
const EVIDENCE_INPUT_TOKEN_ESTIMATE = 8_000;

const HELP = `
Usage: node scripts/verify-evidence-check.ts --result <path> --diff <path> --recipe <path>

Reads verify-result.json + PR diff + authored spec, asks Claude vision whether
the screenshots produced by the recipe visibly demonstrate the diff's change.
Rewrites verify-result.json in place with evidence fields.

Exit 1 only for setup or invocation errors; evidenceVerdict is informational.
`.trim();

interface Argv {
  result?: string;
  diff?: string;
  recipe?: string;
  'screenshots-dir'?: string;
  help?: boolean;
}

interface EvidenceFields {
  evidenceVerdict: 'found' | 'missing' | 'undetermined';
  evidenceReasoning: string;
  evidenceModel: string;
}

function collectScreenshots(rootDir: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (e.name.endsWith('.png')) {
        // C12: enforce real PNG magic bytes (defence-in-depth against an
        // arbitrary file masquerading as .png) and a 5 MB pre-base64 cap.
        // base64 inflates by ~33% so 5 MB raw stays under the SDK's per-
        // request payload comfort zone.
        if (!isPng(p)) continue;
        let size = 0;
        try {
          size = fs.statSync(p).size;
        } catch {
          continue;
        }
        if (size > MAX_SCREENSHOT_BYTES) continue;
        out.push(p);
      }
    }
  }
  walk(rootDir);
  // Stable ordering so two runs with the same screenshots produce
  // identical prompts (helps debugging + observation continuity).
  out.sort();
  return out;
}

function truncateDiff(raw: string): string {
  if (Buffer.byteLength(raw, 'utf-8') <= DIFF_TRUNCATE_BYTES) return raw;
  return raw.slice(0, DIFF_TRUNCATE_BYTES) + '\n[...diff truncated]\n';
}

// Haiku-4-5 pricing: $1/MT input, $5/MT output (Dec-2025 list price).
const HAIKU_INPUT_USD_PER_TOKEN = 0.000001;
const HAIKU_OUTPUT_USD_PER_TOKEN = 0.000005;

function assertVisionWithinCostBudget(): void {
  const raw = process.env.VERIFY_MAX_COST_USD;
  if (raw === undefined) return;
  const budgetUsd = Number(raw);
  if (!Number.isFinite(budgetUsd) || budgetUsd < 0) {
    throw new VerifyCostBudgetError(
      `[evidence-check] VERIFY_MAX_COST_USD must be a non-negative number, got ${JSON.stringify(raw)}.`
    );
  }
  const estimatedCostUsd =
    EVIDENCE_INPUT_TOKEN_ESTIMATE * HAIKU_INPUT_USD_PER_TOKEN +
    MAX_TOKENS * HAIKU_OUTPUT_USD_PER_TOKEN;
  if (estimatedCostUsd > budgetUsd) {
    throw new VerifyCostBudgetError(
      `[evidence-check] estimated vision cost $${estimatedCostUsd.toFixed(
        4
      )} exceeds VERIFY_MAX_COST_USD cap $${budgetUsd.toFixed(2)}.`
    );
  }
}

async function writeResult(
  resultPath: string,
  original: VerifyResult,
  evidence: EvidenceFields
): Promise<void> {
  const merged = {
    ...original,
    ...evidence,
  };
  if (evidence.evidenceVerdict === 'missing') {
    appendNote(merged, `evidence-check: NOT FOUND (reasoning: ${evidence.evidenceReasoning})`);
  }
  fs.writeFileSync(resultPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  // W4 CONTRACT (HMAC verdict integrity): this is a trusted post-processor
  // that mutates the signed verify-result.json (it merges evidence fields).
  // Every trusted writer MUST re-sign so the `.sig` stays current and
  // derive-verdict's gate never sees a stale signature — today the merge
  // only survives because SIGNED_FIELDS coincidentally excludes the
  // evidence* fields; one field addition to SIGNED_FIELDS would otherwise
  // flip every verified PR to forgery-detected. The secret is read the same
  // trusted way write-compile-failure-stub.ts reads it (process.env). When
  // absent (local-dev: no `.sig` was ever written) skip silently — a no-op,
  // not an error, matching how the gate tolerates the unsigned path.
  const secret = process.env.VERIFY_PROVENANCE_SECRET;
  if (secret) {
    try {
      await signResultFile(resultPath, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[evidence-check] re-sign after evidence merge failed: ${msg}`);
    }
  }
}

export function hasEvidenceMissingNote(result: Pick<VerifyResult, 'notes'>): boolean {
  return result.notes?.some((note) => note.startsWith('evidence-check: NOT FOUND')) ?? false;
}

const SYSTEM_PROMPT = `You evaluate whether a PR's UI change is observable in screenshots produced by an automated verify-harness Playwright run.

You will receive:
- The PR's unified diff
- The Playwright recipe that produced the screenshots (so you can see what the test actually asserted on)
- One or more PNG screenshots taken by that recipe

Your task: decide whether the diff's user-visible change is present in at least one of the screenshots.

Respond with strict JSON ONLY (no prose, no code fences):
{
  "verdict": "found" | "missing" | "undetermined",
  "reasoning": "<2-3 sentences>"
}

Definitions:
- "found"        — at least one screenshot clearly contains the changed UI state (e.g. the new icon, the new label, the new focus ring, the toggled dark-mode appearance, the new addon panel item).
- "missing"      — the diff IS user-visible, but none of the screenshots show the changed UI (e.g. the diff swaps an icon inside a conditionally-rendered button, and every screenshot is of an unrelated story).
- "undetermined" — the diff is NOT user-visible (pure type/logic/test/docs/build/CI change), OR the screenshots are too cropped / too low-resolution to make a confident call.

Bias toward "undetermined" rather than "missing" when the diff has no clear user-visible component (e.g. internal refactors, type narrowing, test-only changes). Reserve "missing" for diffs whose visible effect should plausibly appear in a screenshot taken during the recipe.`;

async function main(rawArgv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: rawArgv,
    options: {
      result: { type: 'string' },
      diff: { type: 'string' },
      recipe: { type: 'string' },
      'screenshots-dir': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  const flags = values as Argv;

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  if (!flags.result || !flags.diff || !flags.recipe) {
    console.error(HELP);
    return 1;
  }

  const resultPath = flags.result;
  const original = JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as VerifyResult;

  if (original.verdict !== 'verified') {
    console.error(
      `[evidence-check] initial verdict is '${String(original.verdict)}', skipping evidence check`
    );
    return 0;
  }

  // Vision evidence-check only applies to visual recipes. Non-visual modes
  // (behavioral / pure-fn / build-config) assert behavior directly and have
  // no screenshot to judge; running vision would only ever yield a useless
  // `undetermined`. `mode` is HMAC-signed by the trusted orchestrator, so a
  // forged in-srt result cannot set mode!=visual to dodge this check —
  // derive-verdict's signature gate would already have downgraded it.
  // (Absent `mode` ⇒ legacy/visual ⇒ check runs, preserving back-compat.)
  if (original.mode && original.mode !== 'visual') {
    console.error(
      `[evidence-check] mode is '${original.mode}' (non-visual) — skipping vision evidence check`
    );
    return 0;
  }

  const diff = truncateDiff(fs.readFileSync(flags.diff, 'utf-8'));
  const recipe = fs.readFileSync(flags.recipe, 'utf-8');

  const resultDir = path.dirname(resultPath);
  // Screenshots live in `$PR_HEAD_DIR/.verify-output/<runId>/...`, which is
  // separate from the trusted result dir (`$PR_HEAD_DIR/.verify-out-trusted/`).
  // Scanning resultDir alone returns 0 PNGs even when the recipe captured
  // many — that's the "Recipe produced no screenshots" false-negative.
  // Resolution order: --screenshots-dir flag → $PR_HEAD_DIR/.verify-output
  // env → resultDir fallback (local-dev default where everything is colocated).
  const screenshotsDir =
    flags['screenshots-dir'] ??
    (process.env.PR_HEAD_DIR ? path.join(process.env.PR_HEAD_DIR, '.verify-output') : resultDir);
  const screenshots = collectScreenshots(screenshotsDir).slice(0, MAX_SCREENSHOTS);

  if (screenshots.length === 0) {
    await writeResult(resultPath, original, {
      evidenceVerdict: 'missing',
      evidenceReasoning: 'Recipe produced no screenshots — cannot verify visible evidence.',
      evidenceModel: MODEL,
    });
    return 0;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // 1.7: missing-API-key contract hole. Previously this returned 1 leaving
    // a `verified` result with NO evidence stanza, while the dispatch-error
    // path writes evidenceVerdict:'undetermined'. Make the postcondition
    // consistent — annotate the result so the JSON is never silently
    // un-annotated — and re-sign per the W4 contract (writeResult handles
    // re-signing). Still return 1 to preserve the original setup-error exit
    // signal for callers that branch on it.
    console.error('[evidence-check] ANTHROPIC_API_KEY is required for the vision dispatch.');
    await writeResult(resultPath, original, {
      evidenceVerdict: 'undetermined',
      evidenceReasoning:
        'ANTHROPIC_API_KEY missing — vision evidence-check could not run; verdict left as-is but evidence is undetermined.',
      evidenceModel: MODEL,
    });
    return 1;
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL ?? undefined,
    maxRetries: 1,
  });

  const imageBlocks: Anthropic.ImageBlockParam[] = screenshots.map((p) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: fs.readFileSync(p).toString('base64'),
    },
  }));

  const userText = [
    'PR DIFF:',
    '```',
    diff,
    '```',
    '',
    'PLAYWRIGHT RECIPE (executed and passed):',
    '```ts',
    recipe,
    '```',
    '',
    'SCREENSHOTS (attached above as images, listed by relative path):',
    ...screenshots.map((p) => `- ${path.relative(resultDir, p)}`),
    '',
    'Review the screenshots against the diff and answer.',
  ].join('\n');

  // C11/M5: pre-call budget assertion using a realistic input-token estimate
  // for haiku vision. Mirrors the recipe-author gate so a single run can't
  // double-bill against VERIFY_MAX_COST_USD.
  try {
    assertVisionWithinCostBudget();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[evidence-check] ${msg}`);
    await writeResult(resultPath, original, {
      evidenceVerdict: 'undetermined',
      evidenceReasoning: `Cost budget exceeded: ${msg.slice(0, 200)}`,
      evidenceModel: MODEL,
    });
    return 0;
  }

  let reply: string;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // C12: cache_control on the system prompt — every PR run reuses the
      // same prompt, so caching saves $0.0001/run on the input side.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: userText }],
        },
      ],
    });
    reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    // Surface the full vision response on stderr so reviewers can see the
    // raw reasoning live in the Action log, and persist to the run dir so
    // it lands in the uploaded artifact zip alongside verify-result.json.
    // Sanitise LLM output before printing — strips ANSI/control chars.
    const displayReply = sanitizeUntrustedText(reply);
    const banner = `===== [evidence-check] vision response (model ${MODEL}) =====`;
    console.error(banner);
    console.error(displayReply);
    console.error('='.repeat(banner.length));
    try {
      fs.writeFileSync(
        path.join(resultDir, 'evidence-check-response.json'),
        JSON.stringify(
          { model: MODEL, usage: response.usage, assistantText: reply },
          null,
          2
        ) + '\n',
        'utf-8'
      );
    } catch {
      // artifact emission is best-effort
    }
    // C11: append realized vision cost to the run-level ledger so the next
    // verify-pr-generate(--prior-run-dir) sees it when gating retries.
    try {
      recordDispatchCost(resultDir, {
        attempt: 1,
        model: MODEL,
        inputTokens: Number(response.usage?.input_tokens ?? 0),
        outputTokens: Number(response.usage?.output_tokens ?? 0),
        costUsd: computeRealizedCostUsd(MODEL, response.usage),
      });
    } catch {
      // ledger is best-effort
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[evidence-check] vision dispatch failed: ${msg}`);
    await writeResult(resultPath, original, {
      evidenceVerdict: 'undetermined',
      evidenceReasoning: `Vision dispatch error: ${msg.slice(0, 200)}`,
      evidenceModel: MODEL,
    });
    return 0;
  }

  let parsed: { verdict?: unknown; reasoning?: unknown };
  try {
    const stripped = reply.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    parsed = JSON.parse(stripped) as { verdict?: unknown; reasoning?: unknown };
  } catch {
    await writeResult(resultPath, original, {
      evidenceVerdict: 'undetermined',
      evidenceReasoning: `Could not parse vision JSON; raw reply head: ${reply.slice(0, 200)}`,
      evidenceModel: MODEL,
    });
    return 0;
  }

  const v = parsed.verdict;
  const verdict: EvidenceFields['evidenceVerdict'] =
    v === 'found' || v === 'missing' || v === 'undetermined' ? v : 'undetermined';
  // 2000-char cap (MAX_TOKENS=1024 ≈ 4000 chars, so not the binding limit).
  // Rendered inside a collapsed <details> block in the PR comment, so a
  // longer reasoning paragraph is fine and avoids mid-sentence truncation.
  const reasoning =
    typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 2000) : '(no reasoning)';

  await writeResult(resultPath, original, {
    evidenceVerdict: verdict,
    evidenceReasoning: reasoning,
    evidenceModel: MODEL,
  });

  console.error(`[evidence-check] verdict=${verdict} reasoning="${reasoning}"`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[evidence-check] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
