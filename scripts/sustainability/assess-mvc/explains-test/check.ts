import { getLlmClient } from '../../../utils/llm/client.ts';
import { CheckResultSchema, type CheckResult, type PrContext } from '../types.ts';

/**
 * PURPOSE: A PR is only reviewable if a maintainer can verify it works.
 * The bar is "a third party can run these steps and observe the fix".
 *
 * TYPE: LLM.
 *
 * OUTCOME: The LLM verifies:
 * - PR body has concrete steps (or the linked issue's body does as a fallback)
 * - Steps are framed as user actions a reviewer can take (CLI commands, UI
 *   navigation, project setup), not as the author's self-report
 * - Steps exercise what the diff actually changes
 */
export async function checkExplainsHowToTest(pr: PrContext): Promise<CheckResult> {
  const prompt = buildPrompt(pr);
  const j = await getLlmClient().judge(prompt, CheckResultSchema);
  return {
    id: 'explains-test',
    status: j.status ?? 'fail',
    reasoning: j.reasoning,
    guidance:
      j.status === 'fail'
        ? 'Add a "Manual testing" section with reproducible user-facing steps (CLI/UI), in a real-world project scenario. Do not report how *you* tested and do not merely tell users to run a test suite.'
        : undefined,
  };
}

function buildPrompt(pr: Pick<PrContext, 'body' | 'files' | 'linkedIssues'>): string {
  return [
    'You are evaluating whether a Storybook PR correctly explains how to reproduce the original issue and test that the PR addresses it.',
    'PASS only if a third-party reader can verify the fix works.',
    '- Steps must be user-action framed (CLI commands, UI navigation), NOT unit-test invocations decoupled from user behavior.',
    '- Steps must be reproducible — NOT author self-report ("I tested it locally").',
    '- Steps must exercise what the diff actually changes.',
    '- Steps must be provided in plain text and be reasonably comprehensible for an experienced maintainer.',
    'FAIL otherwise.',
    '',
    'PR body:',
    pr.body,
    '',
    'Linked issue bodies (acceptable as fallback if they read as a verification recipe):',
    pr.linkedIssues.map((i) => `### ${i.owner}/${i.repo}#${i.number}\n${i.body}`).join('\n\n') ||
      '(none)',
    '',
    'Diff overview:',
    pr.files.map((f) => `- ${f.path} (+${f.additions}/-${f.deletions})`).join('\n'),
    '',
    'Return JSON: { status: "pass"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
