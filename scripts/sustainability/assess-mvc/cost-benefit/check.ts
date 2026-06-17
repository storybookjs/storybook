import { z } from 'zod';

import { fetchIssueReactions } from '../../../utils/github/reactions.ts';
import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, PrContext } from '../types.ts';
import { computeDependencyDiff, type DependencyDiff } from './utils/dependencies.ts';
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
 *   - Dependency changes (added AND removed — a PR that sheds dangerous
 *     transitive deps is a BENEFIT, not a cost, and we don't want to flag
 *     such PRs as cost-heavy just because their yarn.lock churned).
 *   - Linked-issue severity label, reactions, and comment count as benefit
 *     signals.
 *   - PR body — the LLM is told to look for dep-update rationale there.
 *
 * Default behavior: small changes (≤ {@link SMALL_CHANGE_NET_LOC} net LOC,
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
  const severity = firstIssue?.labels.find((l) => /^sev:S[1-4]$/.test(l)) ?? null;
  const reactions = firstIssue
    ? await fetchIssueReactions({
        owner: firstIssue.owner,
        repo: firstIssue.repo,
        number: firstIssue.number,
      })
    : { plus1: 0, minus1: 0, tada: 0 };

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
        ? 'Consider splitting the PR, narrowing to the core issue, or shipping experimental scope in an addon.'
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
  reactions: { plus1: number; minus1: number; tada: number };
}): string {
  return [
    'You are reviewing a Storybook pull request for the MVC "cost/benefit" check.',
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
    `Reactions: +${input.reactions.plus1} -${input.reactions.minus1} tada=${input.reactions.tada}`,
    '',
    'PR body (look for dep-change rationale, security mentions, refactor explanations):',
    input.body || '(empty)',
    '',
    'Return JSON: { verdict: "pass"|"warn"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
