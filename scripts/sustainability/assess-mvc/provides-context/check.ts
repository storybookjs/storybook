import { getLlmClient } from '../../../utils/llm/client.ts';
import { CheckResultSchema, type CheckResult, type PrContext } from '../types.ts';
import { computeDiffMetrics } from '../cost-benefit/utils/diff-metrics.ts';

/**
 * PURPOSE: A reviewer shouldn't have to guess at why the author chose their
 * approach. For non-trivial PRs we expect a short "why" — alternatives
 * considered, why this approach won, what was validated. For obviously-
 * trivial PRs, context can be skipped. We let a LLM judge that.
 *
 * TYPE: LLM.
 *
 * OUTCOME: The LLM verifies:
 * - PR body has any rationale OR
 * - LLM judges the PR is simple enough / well-aligned enough with the
 *   linked issue that "why" is self-evident from the diff and issue alone
 */
export async function checkProvidesContext(pr: PrContext): Promise<CheckResult> {
  const diffMetrics = computeDiffMetrics(pr.files);
  const prompt = buildPrompt(pr, diffMetrics);
  const j = await getLlmClient().judge(prompt, CheckResultSchema);
  return {
    id: 'provides-context',
    status: j.status ?? 'fail',
    reasoning: j.reasoning,
    guidance:
      j.status === 'fail'
        ? 'Add a short "Why" section explaining the approach you chose and addressing concerns raised by this assessment.'
        : undefined,
  };
}

function buildPrompt(
  pr: Pick<PrContext, 'body' | 'linkedIssues'>,
  diffMetrics: ReturnType<typeof computeDiffMetrics>
): string {
  return [
    'You are evaluating whether a PR provides good context on why the approach chosen in the PR is appropriate.',
    'In some PRs, maintainers must know why this specific approach was the right one. In other PRs, maintainers need to know why the seemingly unrelated code change addresses the issue (especially if issue root cause was not known).',
    'PASS if both conditions are met:',
    '  1. the PR body explains WHY the author chose their approach, OR the rationale is self-evident from the diff + linked issue',
    '  2. the code change is obviously related to the issue, OR the PR body or code comments explain WHY the seemingly unrelated code change addresses the issue',
    "WARN if the author does not explain their chosen approach and alternatives exist (don't be nitpicky about code standards here; examples include a PR using RegExp instead of AST manipulation, or Channel events instead of manager API state)",
    'FAIL only if a reviewer would have to guess at author intent and guess the relationship between the code and the PR description.',
    'Bias toward PASS for well-aligned PRs.',
    '',
    'IMPORTANT: Small diffs are NOT automatically self-evident: a feature flag flip or one-line tweak in a central file can have major impact and still needs rationale.',
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
    'Return JSON: { status: "pass"|"warn"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
