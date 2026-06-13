import { z } from 'zod';

import { getLlmClient } from '../../../utils/llm/client.ts';
import type { CheckResult, PrContext } from '../types.ts';

const Schema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reasoning: z.string(),
});

/**
 * Check 5 — Explains how to test (happy path).
 *
 * Purpose: a PR is only reviewable if a maintainer (not the author) can
 * verify it works. The bar is "a third party can run these steps and observe
 * the fix" — not "the author says they tested it locally".
 *
 * What we verify:
 *   - PR body has concrete steps (or the linked issue's body reads as a
 *     verification recipe and we can use it as fallback).
 *   - Steps are framed as user actions a reviewer can take (CLI commands, UI
 *     navigation, project setup), not as the author's self-report.
 *   - Steps exercise what the diff actually changes.
 *
 * Out of scope: media (screenshots, videos). LLMs can't reliably evaluate
 * whether a screenshot proves a fix, and we explicitly want to avoid demands
 * that humans have to judge.
 *
 * Why LLM-judged: the failure modes here are too prose-y to detect with
 * regex. We need to distinguish "I tested locally" from "Run `yarn storybook`
 * in the `react-vite` sandbox and observe X" — that's judgement.
 */
export async function checkExplainsHowToTest(pr: PrContext): Promise<CheckResult> {
  const prompt = buildPrompt(pr);
  const j = await getLlmClient().judge(prompt, Schema);
  return {
    id: 'explains-test',
    status: j.verdict,
    evidence: `${j.verdict.toUpperCase()}: ${j.reasoning}`,
    guidance:
      j.verdict === 'fail'
        ? 'Add a "Manual testing" section with reproducible user-facing steps (CLI/UI). Avoid self-reports and unit-only assertions.'
        : undefined,
  };
}

function buildPrompt(pr: Pick<PrContext, 'body' | 'files' | 'linkedIssues'>): string {
  return [
    'You are evaluating the MVC "explains how to test" check on a Storybook PR.',
    'PASS only if a third-party reader can verify the fix works.',
    '- Steps must be user-action framed (CLI commands, UI navigation), NOT unit-test invocations decoupled from user behavior.',
    '- Steps must be reproducible — NOT author self-report ("I tested it locally").',
    '- Steps must exercise what the diff actually changes.',
    'FAIL otherwise. Media (screenshots/videos) is out of scope; do NOT require it.',
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
    'Return JSON: { verdict: "pass"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
