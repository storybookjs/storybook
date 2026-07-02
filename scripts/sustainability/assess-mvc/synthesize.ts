import { CHECK_TEMPLATES, OVERALL_TEMPLATES } from './canned-responses.ts';
import { MARKER, REVIEW_FOOTER } from './config.ts';
import type { CheckId, CheckResult } from './types.ts';

const CHECK_ORDER: CheckId[] = [
  'human',
  'real-problem',
  'duplicate',
  'cost-benefit',
  'explains-test',
  'provides-context',
];

/**
 * Compose the final PR-review body. Composition is deterministic — each
 * check's LLM call has already produced PR-specific reasoning / guidance /
 * maintainerGuidance, so the synthesizer's job is layout, not authorship.
 *
 * Body structure:
 *   1. Intro paragraph (verdict-scoped canned framing).
 *   2. For every non-PASS check (in canonical order): human-titled section
 *      filled from the check's runtime output.
 *   3. A one-line summary of the checks that passed, so the author sees
 *      what they already did right.
 *   4. Conclusion paragraph (verdict-scoped canned framing).
 *   5. Footer (identifies this as automated, points to Discord for
 *      appeal).
 *
 * The returned string is prefixed with the HTML marker so future tooling
 * (re-runs with `--dismiss-previous`, downstream verifiers) can identify
 * bot reviews.
 */
export function synthesizeReview(input: { results: CheckResult[]; earlyAbort: boolean }): string {
  const byId = new Map(input.results.map((r) => [r.id, r]));
  const verdict = input.results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
  const overall = OVERALL_TEMPLATES[verdict];

  const sections: string[] = [overall.intro];

  const nonPass = CHECK_ORDER.map((id) => byId.get(id)).filter(
    (r): r is CheckResult => r != null && r.status !== 'pass'
  );

  for (const result of nonPass) {
    sections.push(renderCheckSection(result));
  }

  const passedIds = input.results.filter((r) => r.status === 'pass').map((r) => r.id);
  if (passedIds.length > 0) {
    const titles = passedIds.map((id) => CHECK_TEMPLATES[id].title).join(', ');
    sections.push(`### Checks that passed\n${titles}.`);
  }

  if (input.earlyAbort) {
    const deferredTitles = input.results
      .filter((r) => r.status === 'deferred')
      .map((r) => CHECK_TEMPLATES[r.id].title);
    if (deferredTitles.length > 0) {
      sections.push(
        [
          '### Checks not performed yet',
          `Because the deterministic checks above failed, the following checks were not evaluated and will need to be re-run once the failures above are addressed:`,
          '',
          deferredTitles.map((t) => `- ${t}`).join('\n'),
        ].join('\n')
      );
    }
  }

  sections.push(overall.conclusion);

  return [MARKER, '', sections.join('\n\n'), '', REVIEW_FOOTER].join('\n');
}

/**
 * Fill a `CheckTemplate` with the check's runtime output. Slots for
 * optional fields (`{guidance}`, `{maintainerGuidance}`) are removed
 * along with their surrounding label lines when the check didn't emit
 * that field — the section reads naturally regardless of which
 * combinations of guidance the check produced.
 */
function renderCheckSection(result: CheckResult): string {
  const { title, template } = CHECK_TEMPLATES[result.id];

  let body = template;
  body = fillSlot(body, 'reasoning', result.reasoning);
  body = fillSlot(body, 'guidance', result.guidance);
  body = fillSlot(body, 'maintainerGuidance', result.maintainerGuidance);

  const heading = `### ${title} — ${statusLabel(result.status)}`;
  return `${heading}\n${body.trim()}`;
}

/**
 * Replace `{slot}` with `value` — or, if `value` is empty, remove the
 * entire line containing the slot. That way an optional slot (like
 * `{guidance}`) doesn't leave a dangling label ("**For you:**") when
 * the check didn't produce guidance.
 */
function fillSlot(text: string, slot: string, value: string | undefined): string {
  const token = `{${slot}}`;
  if (value && value.trim() !== '') {
    return text.replaceAll(token, value.trim());
  }
  return text
    .split('\n')
    .filter((line) => !line.includes(token))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function statusLabel(status: CheckResult['status']): string {
  switch (status) {
    case 'pass':
      return 'passed';
    case 'fail':
      return 'needs changes';
    case 'warn':
      return 'worth a look';
    case 'deferred':
      return 'not evaluated';
  }
}
