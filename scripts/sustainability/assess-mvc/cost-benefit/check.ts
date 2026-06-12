import { z } from 'zod';

import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, PrContext } from '../types.ts';
import { computeDependencyDiff, type DependencyDiff } from './utils/dependencies.ts';
import { computeDiffMetrics } from './utils/diff-metrics.ts';
import { getMostSevereLabel } from '../../../utils/github/labels.ts';

const SMALL_CHANGE_NET_LOC = 30;

const Schema = z.object({
  verdict: z.enum(['pass', 'warn', 'fail']),
  reasoning: z.string(),
});

/**
 * PURPOSE: Every PR adds maintenance surface (review, runtime cost, future
 * breakage). A PR that costs 500 LOC for an edge-case issue is a poor trade;
 * the same 500 LOC for a S1 bug touching most users is obvious. This check
 * pre-assesses the cost/benefit trade-off to flag potentially unmaintainable
 * code early.
 *
 * TYPE: Deterministic precomputes + LLM.
 *
 * PRECOMPUTES:
 * - Diff size (net LOC, files changed)
 * - Dependency change diff
 * - Linked-issue severity label, reaction and comment count as benefit signals
 *
 * OUTCOME: Default behavior: small changes (≤ {@link SMALL_CHANGE_NET_LOC} net LOC,
 * no dep changes either way) short-circuit to PASS without spending tokens.
 * Otherwise the LLM weighs cost against benefit with a bias toward leniency
 * — FAIL only on clear mismatch, WARN under uncertainty, PASS otherwise.
 */
export async function checkCostBenefit(pr: PrContext): Promise<CheckResult> {
  const diffMetrics = computeDiffMetrics(pr.files);
  const deps = computeDependencyDiff(pr.files);

  if (
    diffMetrics.net <= SMALL_CHANGE_NET_LOC &&
    deps.added.length === 0 &&
    deps.removed.length === 0
  ) {
    return {
      id: 'cost-benefit',
      status: 'pass',
      evidence: `Small change (${diffMetrics.net} net LOC); cost/benefit defaults to PASS.`,
    };
  }

  const firstIssue = pr.linkedIssues.find((i) => i.state === 'open');
  const severity = getMostSevereLabel(firstIssue) ?? getMostSevereLabel(pr);
  const reactions = firstIssue?.reactions;

  const prompt = buildPrompt({
    body: pr.body,
    diffMetrics,
    deps,
    severity,
    reactions,
  });
  const j = await getLlmClient().judge(prompt, Schema);

  return {
    id: 'cost-benefit',
    status: j.verdict,
    evidence: `${j.verdict.toUpperCase()}: ${j.reasoning}`,
    guidance:
      j.verdict === 'fail'
        ? 'Consider splitting the PR, narrowing to the core issue, or shipping your proposed change in an addon outside the monorepo.'
        : undefined,
  };
}

function describeDeps(deps: DependencyDiff): string {
  const parts: string[] = [];
  if (deps.added.length > 0) parts.push(`added: ${deps.added.join(', ')}`);
  if (deps.removed.length > 0) parts.push(`removed: ${deps.removed.join(', ')}`);
  if (parts.length === 0) return '(no dependency changes)';
  const sign = deps.delta > 0 ? '+' : '';
  parts.push(`net delta: ${sign}${deps.delta}`);
  return parts.join(' · ');
}

function buildPrompt(input: {
  body: string;
  diffMetrics: ReturnType<typeof computeDiffMetrics>;
  deps: DependencyDiff;
  severity: string | null;
  reactions?: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    confused: number;
    heart: number;
    hooray: number;
    eyes: number;
    rocket: number;
  };
}): string {
  return [
    'You are reviewing a Storybook pull request to judge if it is a viable external contribution. You will decide how much benefit the PR provides relative to its maintenance cost.',
    'FAIL requires CLEAR evidence of mismatch. Default to WARN under uncertainty. Default to PASS for small changes.',
    'Edge-case linked issues warrant a stricter maintenance ceiling than broad ones.',
    '',
    'IMPORTANT framing for dependency changes:',
    '  - A net-positive dep delta is a maintenance COST (more surface to audit, update, secure).',
    '  - A net-negative dep delta is often a BENEFIT — a PR that drops legacy or vulnerable',
    '    transitive deps is doing maintenance work for us, not adding cost.',
    '  - When the PR body explicitly justifies dep changes (e.g., "removes dependency X because of',
    '    CVE-Y", "consolidates on shared util Z"), give the author credit and weight that as a',
    '    benefit signal regardless of diff size.',
    '',
    `Diff: +${input.diffMetrics.added}/-${input.diffMetrics.removed} (net ${input.diffMetrics.net}) across ${input.diffMetrics.filesChanged} files.`,
    `Dependencies: ${describeDeps(input.deps)}`,
    '',
    `Linked-issue severity: ${input.severity ?? '(none)'}`,
    `Reactions: +${input.reactions?.['+1'] ?? 0} -${input.reactions?.['-1'] ?? 0} laugh=${input.reactions?.laugh ?? 0} confused=${input.reactions?.confused ?? 0} heart=${input.reactions?.heart ?? 0} hooray=${input.reactions?.hooray ?? 0} eyes=${input.reactions?.eyes ?? 0} rocket=${input.reactions?.rocket ?? 0} total=${input.reactions?.total_count ?? 0}`,
    '',
    'PR body (look for dep-change rationale, security mentions, refactor explanations):',
    input.body || '(empty)',
    '',
    'Return JSON: { verdict: "pass"|"warn"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
