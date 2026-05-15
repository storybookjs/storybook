// Shared recipe-author engine. Stateless w.r.t. global env — all I/O is
// scoped to the run-dir passed in. Both verify-pr-author (sdk mode) and
// the verify-recipe-author skill (stdin mode) call this entry point.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { assertNoDeniedPatterns } from './recipe-deny.ts';
import { lintRecipeSpec } from './lint-invocation.ts';

export interface PromptBundle {
  version: 1;
  prNumber: number;
  runId: string;
  outputSpecPath: string;
  force: boolean;
  prompt: string;
  metadata: {
    agentModel: string;
    referenceSpecs: string[];
    triageGlobs: string[];
    generatedAt: string;
    /**
     * C10: char/4 token estimate stamped at bundle-emit time AFTER all
     * downstream sections (target suggestion, source dump, retry context)
     * have been appended. Used by telemetry to chart per-bundle prompt
     * growth and to budget retries.
     */
    estimatedTokens?: number;
  };
  /**
   * C11: cost-budget short-circuit. Set by verify-pr-generate when the
   * prior run (--prior-run-dir) burned more than half of VERIFY_MAX_COST_USD.
   * Consumers (workflow) MUST treat this as a refusal-to-retry signal:
   * skip dispatch, surface the notice as a comment / annotation, exit clean.
   */
  costBudgetNotice?: string;
}

export type DispatchFn = (input: { prompt: string; retryMessage?: string }) => Promise<string>;

export type RecipeAuthorStatus =
  | 'spec-written'
  | 'collision'
  | 'deny-regex-hit'
  | 'extract-failed'
  | 'lint-failed'
  | 'regex-failed'
  | 'retry-requested';

export interface RecipeAuthorResult {
  status: RecipeAuthorStatus;
  specPath: string;
  attempts: number;
  lint?: 'clean' | 'failed';
  regex?: 'clean' | 'failed';
  deniedPattern?: string;
  retryMessage?: string;
  runId?: string;
  agentModel: string;
  generatedAt: string;
}

export interface RunRecipeAuthorInput {
  bundle: PromptBundle;
  dispatch: DispatchFn;
  runDir: string;
  /** 1 = first attempt; 2 = retry pass (skill stdin handoff). */
  attempt?: 1 | 2;
  /** Allow either 'sdk' or 'stdin' to govern retry-vs-loop semantics. */
  mode?: 'sdk' | 'stdin';
}

const SPEC_FENCE_START = '<<<SPEC_START>>>';
const SPEC_FENCE_END = '<<<SPEC_END>>>';

// UC14: inlined retry policy (previously in recipe-retry-policy.ts).
// One declarative table maps ESLint rule ids to a priority bucket plus a
// human-readable retry message. Unknown rule ids collapse to the lowest
// priority. Keep the table flat — there is exactly one caller (this file)
// and exactly one consumer (the retry-message formatter below).
export const MAX_RECIPE_ATTEMPTS = 2;

interface ErrorRule {
  readonly ruleIds: readonly string[];
  readonly priority: number;
  readonly human: string;
}

const ERROR_RULES: readonly ErrorRule[] = [
  {
    ruleIds: ['verify-recipes/listener-before-goto'],
    priority: 1,
    human: "Register page.on(...) BEFORE first page.goto.",
  },
  {
    ruleIds: ['verify-recipes/attach-pattern'],
    priority: 2,
    human:
      "Both testInfo.attach('pageErrors', ...) and testInfo.attach('consoleErrors', ...) MUST appear in a finally block.",
  },
  {
    ruleIds: [
      '@typescript-eslint/no-unused-vars',
      'no-unused-vars',
      'import/no-unresolved',
      'import/no-extraneous-dependencies',
      'no-restricted-imports',
      'no-restricted-syntax',
    ],
    priority: 3,
    human: 'Imports must be limited to ./_util.ts and @playwright/test.',
  },
] as const;

const UNKNOWN_RULE_PRIORITY = 99;
const RAW_JSON_CAP_BYTES = 8 * 1024;

interface EslintViolationInput {
  ruleId: string;
  message: string;
}

interface CategorizedBucket {
  priority: number;
  humanMessage: string;
  rawRuleIds: string[];
  messages: string[];
}

function ruleToBucket(ruleId: string): ErrorRule | null {
  for (const rule of ERROR_RULES) {
    if (rule.ruleIds.includes(ruleId)) return rule;
  }
  return null;
}

function categorizeEslintViolations(
  violations: ReadonlyArray<EslintViolationInput>
): CategorizedBucket[] {
  const byPriority = new Map<number, CategorizedBucket>();
  for (const v of violations) {
    const ruleId = v.ruleId ?? '';
    const rule = ruleToBucket(ruleId);
    const priority = rule ? rule.priority : UNKNOWN_RULE_PRIORITY;
    const humanMessage =
      rule?.human ?? 'Imports must be limited to ./_util.ts and @playwright/test.';
    const existing = byPriority.get(priority);
    if (existing) {
      if (!existing.rawRuleIds.includes(ruleId)) existing.rawRuleIds.push(ruleId);
      existing.messages.push(v.message);
    } else {
      byPriority.set(priority, {
        priority,
        humanMessage,
        rawRuleIds: [ruleId],
        messages: [v.message],
      });
    }
  }
  return Array.from(byPriority.values()).sort((a, b) => a.priority - b.priority);
}

function formatRetryMessage(
  buckets: ReadonlyArray<CategorizedBucket>,
  rawEslintJson: string
): string {
  const lines: string[] = [];
  lines.push(
    'Your previous attempt failed the recipe-author gates. Re-emit a corrected spec body between the same fenced markers.'
  );
  lines.push('');
  if (buckets.length === 0) {
    lines.push('No categorized violations — see the raw ESLint output below.');
  } else {
    lines.push('Fix the following, in priority order:');
    lines.push('');
    for (const b of buckets) {
      lines.push(`- ${b.humanMessage}`);
      if (b.rawRuleIds.length > 0) {
        lines.push(`  rules: ${b.rawRuleIds.filter(Boolean).join(', ') || '(post-write regex)'}`);
      }
      for (const m of b.messages.slice(0, 3)) {
        lines.push(`  - ${m}`);
      }
    }
    lines.push('');
  }
  lines.push('Raw ESLint output (truncated to 8 KB):');
  lines.push('```json');
  const capped =
    rawEslintJson.length <= RAW_JSON_CAP_BYTES
      ? rawEslintJson
      : `${rawEslintJson.slice(0, RAW_JSON_CAP_BYTES)}\n[...truncated]`;
  lines.push(capped);
  lines.push('```');
  return lines.join('\n');
}

// C7: spec extraction. Reject the reply if it contains more than one
// `SPEC_START` marker (an attacker who threaded a fence into PR
// title/body could otherwise smuggle a parallel spec body through). Use
// the LAST `SPEC_END` after the first `SPEC_START` so a payload like
// `SPEC_START ... <<<SPEC_END>>> attacker code <<<SPEC_END>>>` cannot
// truncate the real spec body. Returns null on any failure to extract.
function extractSpecBody(reply: string): string | null {
  const startIdx = reply.indexOf(SPEC_FENCE_START);
  if (startIdx === -1) return null;
  // Reject duplicate SPEC_START — there must be exactly one.
  const secondStart = reply.indexOf(SPEC_FENCE_START, startIdx + SPEC_FENCE_START.length);
  if (secondStart !== -1) return null;
  const endIdx = reply.lastIndexOf(SPEC_FENCE_END);
  if (endIdx === -1 || endIdx <= startIdx + SPEC_FENCE_START.length) return null;
  const body = reply.slice(startIdx + SPEC_FENCE_START.length, endIdx);
  return body.replace(/^\s*\n/, '').replace(/\n\s*$/, '\n');
}

// UC15: build the canonical provenance comment block (deterministic given
// the same bundle + generatedAt). The returned `signed` is the bytes the
// HMAC covers when a secret is supplied.
function buildSignedHeader(
  bundle: PromptBundle,
  generatedAt: string
): { signed: string } {
  const refs = bundle.metadata.referenceSpecs.length
    ? bundle.metadata.referenceSpecs.join(', ')
    : '(none)';
  const globs = bundle.metadata.triageGlobs.length
    ? bundle.metadata.triageGlobs.join(', ')
    : '(none)';
  const signed = [
    '/**',
    ` * Generated by the verify-pr-author harness (Lane A v4).`,
    ` * generatedAt: ${generatedAt}`,
    ` * runId: ${bundle.runId}`,
    ` * prNumber: ${bundle.prNumber}`,
    ` * agentModel: ${bundle.metadata.agentModel}`,
    ` * referenceSpecs: ${refs}`,
    ` * triageGlobs: ${globs}`,
    ` *`,
    ` * Local-dev: this file is human-reviewed before execution. Edit freely.`,
    ` * CI single-round: this file is materialised into the runner workspace`,
    ` * and executed without intermediate human review. Deny-regex + scoped`,
    ` * lint are the load-bearing controls (see scripts/verify/SECURITY.md).`,
    ` * Provenance block above is informational only.`,
    ' */',
    '',
  ].join('\n');
  return { signed };
}

function buildProvenanceHeader(bundle: PromptBundle, generatedAt: string): string {
  const { signed } = buildSignedHeader(bundle, generatedAt);

  // UC15: in CI the provenance secret is MANDATORY. A workflow that
  // forgot to wire the secret would otherwise silently emit unsigned
  // headers and downstream tamper-detection would always pass. Surface
  // the misconfig as a hard failure so a deployer notices immediately.
  const secret = process.env.VERIFY_PROVENANCE_SECRET;
  if (process.env.CI === 'true' && !secret) {
    throw new Error(
      '[recipe-author-core] VERIFY_PROVENANCE_SECRET is required in CI (CI=true). ' +
        'Configure the secret on the workflow and re-run.'
    );
  }
  if (!secret) return signed;
  const mac = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return `${signed}// @verify-provenance-hmac: ${mac}\n`;
}

/**
 * UC15: read a materialised recipe spec on disk and verify that its
 * provenance HMAC line matches the bundle the workflow believes drove
 * the recipe generation. Called by the verify-pr entry script BEFORE
 * Playwright executes the spec — tamper detection on the untrusted
 * PR-head workspace.
 *
 * - Local-dev (no secret): both header forms accepted; this helper is a
 *   no-op and resolves successfully.
 * - CI (secret set): the header MUST end with a matching HMAC line. A
 *   mismatch or missing line throws — callers should treat the throw as
 *   a fatal "spec tampered" event.
 */
export function assertProvenanceMatchesBundle(
  specPath: string,
  bundle: PromptBundle
): void {
  const secret = process.env.VERIFY_PROVENANCE_SECRET;
  if (!secret) return; // local-dev: nothing to verify.

  const generatedAt = bundle.metadata.generatedAt;
  const { signed } = buildSignedHeader(bundle, generatedAt);
  const expectedMac = crypto.createHmac('sha256', secret).update(signed).digest('hex');

  const source = fs.readFileSync(specPath, 'utf-8');
  const hmacLineRe = /^\/\/ @verify-provenance-hmac:\s*([0-9a-f]+)\s*$/m;
  const match = hmacLineRe.exec(source);
  if (!match) {
    throw new Error(
      `[recipe-author-core] provenance HMAC missing from ${specPath}. Spec may have been tampered with.`
    );
  }
  const actualMac = match[1];
  const expected = Buffer.from(expectedMac, 'hex');
  const actual = Buffer.from(actualMac, 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error(
      `[recipe-author-core] provenance HMAC mismatch on ${specPath}. Bundle does not match the recipe on disk.`
    );
  }
}

function violationsFromLint(
  ruleViolations: Array<{ ruleId: string | null; messages: Array<{ message: string }> }>
): EslintViolationInput[] {
  const out: EslintViolationInput[] = [];
  for (const v of ruleViolations) {
    for (const m of v.messages) {
      out.push({ ruleId: v.ruleId ?? '', message: m.message });
    }
  }
  return out;
}

async function writeResultJson(
  runDir: string,
  result: RecipeAuthorResult,
  fileName = 'result.json'
): Promise<void> {
  await fs.promises.mkdir(runDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(runDir, fileName),
    JSON.stringify(result, null, 2) + '\n',
    'utf-8'
  );
}

export async function runRecipeAuthor(input: RunRecipeAuthorInput): Promise<RecipeAuthorResult> {
  const { bundle, dispatch, runDir } = input;
  const attempt: 1 | 2 = input.attempt ?? 1;
  const mode: 'sdk' | 'stdin' = input.mode ?? 'sdk';
  // Pin generatedAt to the bundle's generation timestamp so that the D8
  // provenance header is byte-stable across stdin/sdk invocations of the
  // same bundle (AC-V4-7a parity).
  const generatedAt = bundle.metadata.generatedAt;
  const agentModel = bundle.metadata.agentModel;

  // 1. TOCTOU collision check (D9).
  if (fs.existsSync(bundle.outputSpecPath) && !bundle.force) {
    const result: RecipeAuthorResult = {
      status: 'collision',
      specPath: bundle.outputSpecPath,
      attempts: 0,
      agentModel,
      generatedAt,
    };
    await writeResultJson(runDir, result);
    return result;
  }

  // When invoked with --retry-of (attempt=2), the prior attempt 1 already
  // counted toward the budget; seed the counter so result.json reports the
  // true attempt index (AC-V4-10).
  let attempts = attempt - 1;
  let retryMessageForNext: string | undefined;

  // Inner attempt loop. Up to MAX_RECIPE_ATTEMPTS iterations.
  while (attempts < MAX_RECIPE_ATTEMPTS) {
    attempts += 1;

    const reply = await dispatch({
      prompt: bundle.prompt,
      retryMessage: retryMessageForNext,
    });

    const specBody = extractSpecBody(reply);
    if (specBody === null) {
      const result: RecipeAuthorResult = {
        status: 'extract-failed',
        specPath: bundle.outputSpecPath,
        attempts,
        agentModel,
        generatedAt,
      };
      await writeResultJson(runDir, result);
      return result;
    }

    try {
      assertNoDeniedPatterns(specBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const deniedMatch = msg.match(/denied pattern "([^"]+)"/);
      const result: RecipeAuthorResult = {
        status: 'deny-regex-hit',
        specPath: bundle.outputSpecPath,
        attempts,
        deniedPattern: deniedMatch?.[1],
        agentModel,
        generatedAt,
      };
      await writeResultJson(runDir, result);
      return result;
    }

    const header = buildProvenanceHeader(bundle, generatedAt);
    const fullSource = `${header}${specBody}`;
    const candidatePath = path.join(runDir, 'candidate.spec.ts');
    await fs.promises.mkdir(runDir, { recursive: true });
    await fs.promises.writeFile(candidatePath, fullSource, 'utf-8');

    const lintResult = await lintRecipeSpec({ specPath: candidatePath });
    const lintOk = lintResult.exitCode === 0;

    if (lintOk) {
      // D9 re-check: outputSpecPath may have appeared while we were dispatching.
      if (fs.existsSync(bundle.outputSpecPath) && !bundle.force) {
        const result: RecipeAuthorResult = {
          status: 'collision',
          specPath: bundle.outputSpecPath,
          attempts,
          lint: 'clean',
          regex: 'clean',
          agentModel,
          generatedAt,
        };
        await writeResultJson(runDir, result);
        return result;
      }
      await fs.promises.mkdir(path.dirname(bundle.outputSpecPath), { recursive: true });
      await fs.promises.rename(candidatePath, bundle.outputSpecPath);
      const result: RecipeAuthorResult = {
        status: 'spec-written',
        specPath: bundle.outputSpecPath,
        attempts,
        lint: 'clean',
        regex: 'clean',
        agentModel,
        generatedAt,
      };
      await writeResultJson(runDir, result);
      return result;
    }

    // Failure path: build a retry message and decide whether to loop or
    // return for the orchestrator to drive a fresh dispatch.
    const violations = violationsFromLint(lintResult.ruleViolations);
    const buckets = categorizeEslintViolations(violations);
    const rawJson = JSON.stringify(lintResult.rawJson ?? lintResult.stdout, null, 2);
    const retryMessage = formatRetryMessage(buckets, rawJson);

    const exhausted = attempts >= MAX_RECIPE_ATTEMPTS;
    if (exhausted) {
      // Inner-only retry: 2 attempts max, then return a terminal failure
      // status for the workflow to surface. No outer retry exists.
      const result: RecipeAuthorResult = {
        status: 'lint-failed',
        specPath: bundle.outputSpecPath,
        attempts,
        lint: 'failed',
        retryMessage,
        agentModel,
        generatedAt,
      };
      await writeResultJson(runDir, result);
      return result;
    }

    // First failure with attempts remaining.
    if (mode === 'stdin' && attempt === 1) {
      // Skill mode: the orchestrator runs the second dispatch under
      // human review. We hand the retry-message back through a partial
      // result and exit cleanly so the skill can frame it.
      const partial: RecipeAuthorResult = {
        status: 'retry-requested',
        specPath: bundle.outputSpecPath,
        attempts,
        lint: 'failed',
        retryMessage,
        runId: bundle.runId,
        agentModel,
        generatedAt,
      };
      await writeResultJson(runDir, partial, 'result.partial.json');
      return partial;
    }

    // SDK mode (or stdin attempt 2 supplied via --retry-of): loop in-process.
    retryMessageForNext = retryMessage;
  }

  // UX8: the loop above returns on every reachable branch. If control
  // somehow falls through, that is a programming error — fail loudly
  // rather than synthesising a fake `lint-failed` result that obscures
  // the real defect.
  throw new Error('[verify-pr-author] unreachable retry loop exit');
}
