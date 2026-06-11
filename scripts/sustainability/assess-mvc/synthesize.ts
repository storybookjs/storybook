import { z } from 'zod';

import { getLlmClient } from '../../utils/llm/client.ts';
import { CANNED, OVERALL } from './canned-responses.ts';
import { MARKER } from './config.ts';
import type { CheckResult } from './types.ts';

const Schema = z.object({ reviewBody: z.string() });

/**
 * Compose the final PR-review body from all six check results.
 *
 * The LLM tailors per-criterion canned templates with PR-specific evidence;
 * we never invent new wording from scratch (keeps the voice consistent across
 * thousands of reviews). When the LLM phase was early-aborted by a
 * deterministic FAIL, this also lists the not-performed checks so the author
 * knows what other criteria they must satisfy after addressing the failing
 * deterministic ones.
 *
 * The returned string is prefixed with the HTML marker so future tooling
 * (re-runs with `--dismiss-previous`, downstream verifiers) can identify bot
 * reviews.
 */
export async function synthesizeReview(input: {
  results: CheckResult[];
  earlyAbort: boolean;
}): Promise<string> {
  const verdict = input.results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
  const tailoring = input.results
    .map(
      (r) =>
        `- [${r.status.toUpperCase()}] ${r.id}: ${r.evidence}\n  Canned template: ${CANNED[r.id]}`
    )
    .join('\n');
  const notPerformed = input.results.filter((r) => r.status === 'deferred').map((r) => r.id);
  const prompt = [
    'Compose a Storybook PR review body in markdown that the author and other reviewers will read.',
    'Voice: constructive, friendly, never accusatory ("our automation has identified ways to improve").',
    '',
    `Overall verdict template:\n${verdict === 'pass' ? OVERALL.pass : OVERALL.fail}`,
    '',
    'Per-check tailoring (start from the canned template; tailor with PR-specific evidence; drop irrelevant sentences):',
    tailoring,
    '',
    input.earlyAbort
      ? `IMPORTANT: deterministic checks failed. The following LLM-judged checks were NOT performed and must be listed in the body so the author knows they remain to be evaluated: ${notPerformed.join(', ')}.`
      : '',
    '',
    'Return JSON: { "reviewBody": "<markdown>" }. Do NOT include the HTML marker; it is appended by the script.',
  ]
    .filter(Boolean)
    .join('\n');

  const { reviewBody } = await getLlmClient().judge(prompt, Schema);
  return `${MARKER}\n${reviewBody}`;
}
