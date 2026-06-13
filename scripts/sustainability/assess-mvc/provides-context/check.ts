import { z } from 'zod';

import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, PrContext } from '../types.ts';
import { computeDiffMetrics } from '../cost-benefit/utils/diff-metrics.ts';

const Schema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reasoning: z.string(),
});

/**
 * Check 6 — Provides context & justification.
 *
 * Purpose: a reviewer shouldn't have to guess at why the author chose their
 * approach. For non-trivial PRs we expect a short "why" — alternatives
 * considered, why this approach won, what was validated. For obviously-
 * trivial PRs (typo fixes, version bumps, etc.) we don't want to demand
 * essays, but we also don't want to short-circuit on LOC alone: a 3-line
 * change that flips a feature flag in a central file has the same review
 * burden as a 300-line refactor. The LLM judges with the full diff in hand.
 *
 * What we verify:
 *   - PR body has any rationale OR
 *   - LLM judges the PR is simple enough / well-aligned enough with the
 *     linked issue that "why" is self-evident from the diff and issue alone.
 *
 * Bias: skew toward PASS for well-aligned PRs. The check should not block on
 * paper-essay requirements; it should fail only when a reviewer would
 * genuinely have to guess at intent.
 *
 * Boundary against Check 5: Check 5 = "how a reviewer verifies the fix
 * works" (third-party reproducible recipe). Check 6 = "why the author chose
 * this approach" (rationale, alternatives, validation thinking).
 */
export async function checkProvidesContext(pr: PrContext): Promise<CheckResult> {
  const diffMetrics = computeDiffMetrics(pr.files);
  const prompt = buildPrompt(pr, diffMetrics);
  const j = await getLlmClient().judge(prompt, Schema);
  return {
    id: 'provides-context',
    status: j.verdict,
    evidence: `${j.verdict.toUpperCase()}: ${j.reasoning}`,
    guidance:
      j.verdict === 'fail'
        ? 'Add a short "Why" section explaining the approach you chose and any alternatives considered.'
        : undefined,
  };
}

function buildPrompt(
  pr: Pick<PrContext, 'body' | 'linkedIssues'>,
  diffMetrics: ReturnType<typeof computeDiffMetrics>
): string {
  return [
    'You are evaluating the MVC "provides context" check on a Storybook PR.',
    'PASS if the PR body explains WHY the author chose this approach, OR the rationale is self-evident from the diff + linked issue.',
    'FAIL only if a reviewer would have to guess at intent.',
    'Bias toward PASS for well-aligned PRs. Small diffs are NOT automatically self-evident: a',
    'flag flip or one-line tweak in a central file can have major impact and still needs rationale.',
    'Look at what the change actually does, not just its size.',
    '',
    'PR body:',
    pr.body,
    '',
    'Linked issues:',
    pr.linkedIssues
      .map((i) => `### ${i.owner}/${i.repo}#${i.number} — ${i.title}\n${i.body}`)
      .join('\n\n') || '(none)',
    '',
    `Diff: +${diffMetrics.added}/-${diffMetrics.removed} across ${diffMetrics.filesChanged} files (${diffMetrics.files.join(', ')}).`,
    '',
    'Return JSON: { verdict: "pass"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
