import { z } from 'zod';

import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, PrContext } from '../types.ts';

const FEATURE_FITS = ['augments-api', 'popular-tech', 'quality-of-life', 'none'] as const;

const Schema = z.object({
  matchesIssue: z.boolean(),
  category: z.enum(['bug', 'feature', 'maintenance', 'docs', 'dependencies', 'other']),
  reasoning: z.string(),
  featureFit: z.enum(FEATURE_FITS).optional(),
});

/**
 * Check 2 — Fixes a real problem / non-controversial feature.
 *
 * Purpose: an MVC contribution must solve a tracked problem. A PR without a
 * linked open issue is either solving something we don't yet agree is a
 * problem (which is a discussion, not a contribution) or — more often — is a
 * drive-by attempt that the author can't articulate the value of. Either way,
 * the right next step isn't a code review.
 *
 * What we verify:
 *   - At least one linked issue exists.
 *   - At least one of those issues is open (closed issues represent fixed
 *     problems; if the issue is closed we don't owe the PR a review).
 *   - The PR substantively addresses the linked issue (LLM judgement).
 *
 * Feature sub-rule: when the LLM categorises the PR as a feature, we
 * additionally require it to fit one of three buckets — augments an existing
 * API for addon/framework authors, adds support for popular tech, or is a
 * quality-of-life improvement. PRs that don't fit are redirected to the addon
 * ecosystem.
 *
 * The deterministic gates (no linked issue / linked issue closed) run before
 * any LLM call to save tokens on definitively-failing PRs.
 */
export async function checkRealProblem(pr: PrContext): Promise<CheckResult> {
  if (pr.linkedIssues.length === 0) {
    return {
      id: 'real-problem',
      status: 'fail',
      evidence: 'No linked issue.',
      guidance:
        'Link an existing open issue this PR addresses. Without a linked issue, we cannot verify the change solves a tracked problem.',
    };
  }
  const openIssues = pr.linkedIssues.filter((i) => i.state === 'open');
  if (openIssues.length === 0) {
    return {
      id: 'real-problem',
      status: 'fail',
      evidence: 'All linked issues are closed.',
      guidance:
        'The linked issue is closed. If the problem regressed, please reopen it (or open a fresh one) and link that.',
    };
  }

  const prompt = buildPrompt(pr, openIssues);
  const judgment = await getLlmClient().judge(prompt, Schema);

  if (!judgment.matchesIssue) {
    return {
      id: 'real-problem',
      status: 'fail',
      evidence: `LLM judged the PR does not substantively address the linked issue: ${judgment.reasoning}`,
      guidance:
        'Re-read the linked issue and either revise the PR to address its core ask or link the correct issue.',
    };
  }

  if (judgment.category === 'feature' && (judgment.featureFit ?? 'none') === 'none') {
    return {
      id: 'real-problem',
      status: 'fail',
      evidence:
        'Feature does not fit accepted categories (augments-API / popular-tech / quality-of-life).',
      guidance:
        'Features must augment APIs for addon authors, add support for popular tech, or improve QoL. Consider shipping this in the addon ecosystem.',
    };
  }

  const hasUnresolved = pr.unresolved.length > 0;
  return {
    id: 'real-problem',
    status: hasUnresolved ? 'warn' : 'pass',
    evidence: hasUnresolved
      ? `Matches linked issue (${judgment.category}): ${judgment.reasoning} (warn: unresolved refs ${pr.unresolved.join(', ')})`
      : `Matches linked issue (${judgment.category}): ${judgment.reasoning}`,
  };
}

function buildPrompt(
  pr: Pick<PrContext, 'title' | 'body' | 'labels'>,
  openIssues: PrContext['linkedIssues']
): string {
  const issues = openIssues
    .map(
      (i) =>
        `### Linked issue ${i.owner}/${i.repo}#${i.number} — ${i.title}\nLabels: ${i.labels.join(', ')}\n\n${i.body}`
    )
    .join('\n\n');
  return [
    'You are reviewing a Storybook pull request for the MVC "real problem" check.',
    '',
    `PR title: ${pr.title}`,
    `PR labels: ${pr.labels.join(', ')}`,
    'PR body:',
    pr.body,
    '',
    'Linked issues:',
    issues,
    '',
    'Decide:',
    '- matchesIssue: does the PR substantively address the linked issue? (not tangential, not different problem)',
    '- category: one of bug | feature | maintenance | docs | dependencies | other',
    '- featureFit (only if category=feature): augments-api | popular-tech | quality-of-life | none',
    '- reasoning: one short sentence (≤ 200 chars)',
  ].join('\n');
}
