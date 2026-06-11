import { z } from 'zod';

import { fetchIssueReactions } from '../../../utils/github/reactions.ts';
import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, PrContext } from '../types.ts';
import { computeAddedDependencies } from './utils/dependencies.ts';
import { computeDiffMetrics } from './utils/diff-metrics.ts';

const SMALL_CHANGE_NET_LOC = 30;

const Schema = z.object({
  verdict: z.enum(['pass', 'warn', 'fail']),
  reasoning: z.string(),
});

/**
 * Check 4 — Cost / benefit ratio.
 *
 * Purpose: every PR adds maintenance surface (review, runtime cost, future
 * breakage). A PR that costs 500 LOC for an edge-case issue with three +1s is
 * a poor trade for a small team; the same 500 LOC for a S1 bug touching 80%
 * of users is obvious. This check makes the trade explicit so reviewers don't
 * sleepwalk into either accepting too much or rejecting too little.
 *
 * What we verify (precomputes feed the LLM):
 *   - Diff size (net LOC, files changed).
 *   - Newly added dependencies (any section — Storybook ships dev deps too).
 *   - Cyclomatic complexity hot-spots (Phase 2 wires the cyclomatic util in
 *     when we have file-contents fetching).
 *   - Linked-issue severity label, reactions, and comment count as benefit
 *     signals.
 *
 * Default behavior: small changes (≤ {@link SMALL_CHANGE_NET_LOC} net LOC,
 * no new deps) short-circuit to PASS without spending tokens. Otherwise the
 * LLM weighs cost against benefit with a bias toward leniency — FAIL only on
 * clear mismatch, WARN under uncertainty, PASS otherwise.
 */
export async function checkCostBenefit(pr: PrContext): Promise<CheckResult> {
  const diffMetrics = computeDiffMetrics(pr.files);
  const addedDeps = computeAddedDependencies(pr.files);

  if (diffMetrics.net <= SMALL_CHANGE_NET_LOC && addedDeps.length === 0) {
    return {
      id: 'cost-benefit',
      status: 'pass',
      evidence: `Small change (${diffMetrics.net} net LOC); cost/benefit defaults to PASS.`,
    };
  }

  const firstIssue = pr.linkedIssues.find((i) => i.state === 'open');
  const severity = firstIssue?.labels.find((l) => /^sev:S[1-4]$/.test(l)) ?? null;
  const reactions = firstIssue
    ? await fetchIssueReactions({
        owner: firstIssue.owner,
        repo: firstIssue.repo,
        number: firstIssue.number,
      })
    : { plus1: 0, minus1: 0, tada: 0 };

  const prompt = buildPrompt({
    diffMetrics,
    addedDeps,
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
        ? 'Consider splitting the PR, narrowing to the core issue, or shipping experimental scope in an addon.'
        : undefined,
  };
}

function buildPrompt(input: {
  diffMetrics: ReturnType<typeof computeDiffMetrics>;
  addedDeps: string[];
  severity: string | null;
  reactions: { plus1: number; minus1: number; tada: number };
}): string {
  return [
    'You are reviewing a Storybook pull request for the MVC "cost/benefit" check.',
    'FAIL requires CLEAR evidence of mismatch. Default to WARN under uncertainty. Default to PASS for small changes.',
    'Edge-case linked issues warrant a stricter maintenance ceiling than broad ones.',
    '',
    `Diff: +${input.diffMetrics.added}/-${input.diffMetrics.removed} (net ${input.diffMetrics.net}) across ${input.diffMetrics.filesChanged} files.`,
    `Added dependencies: ${input.addedDeps.join(', ') || '(none)'}`,
    '',
    `Linked-issue severity: ${input.severity ?? '(none)'}`,
    `Reactions: +${input.reactions.plus1} -${input.reactions.minus1} tada=${input.reactions.tada}`,
    '',
    'Return JSON: { verdict: "pass"|"warn"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
