import type { CheckId } from './types.ts';

/**
 * Section shape for a single check in the review body. Templates carry the
 * canned framing (human-readable title, subsection labels, section order);
 * the check's runtime output fills the slots. The synthesizer substitutes:
 *
 *   {reasoning}          — always present
 *   {guidance}           — omitted (with its label) when the check didn't emit it
 *   {maintainerGuidance} — omitted (with its label) when the check didn't emit it
 *
 * No LLM tailoring happens at synthesis time — each check's LLM call has
 * already produced PR-specific reasoning / guidance / maintainerGuidance.
 * The synthesizer's job is layout, not authorship.
 */
export interface CheckTemplate {
  /** Human-language section title. */
  title: string;
  /** Markdown template with `{reasoning}` / `{guidance}` / `{maintainerGuidance}` slots. */
  template: string;
}

const SECTION_TEMPLATE = [
  '{reasoning}',
  '',
  '**For you as the PR author:** {guidance}',
  '',
  '**For maintainers reviewing this PR:** {maintainerGuidance}',
].join('\n');

export const CHECK_TEMPLATES: Record<CheckId, CheckTemplate> = {
  human: {
    title: 'Human authorship',
    template: SECTION_TEMPLATE,
  },
  'real-problem': {
    title: 'Solves a tracked problem',
    template: SECTION_TEMPLATE,
  },
  duplicate: {
    title: 'Not duplicating existing work',
    template: SECTION_TEMPLATE,
  },
  'cost-benefit': {
    title: 'Maintainability',
    template: SECTION_TEMPLATE,
  },
  'explains-test': {
    title: 'How to test',
    template: SECTION_TEMPLATE,
  },
  'provides-context': {
    title: 'Rationale',
    template: SECTION_TEMPLATE,
  },
};

/**
 * Intro and conclusion framing for the review body. Verdict-scoped: `pass`
 * congratulates and points to next-step review; `fail` frames the flagged
 * items as scaffolding for a healthy review queue rather than a personal
 * judgment. Not per-PR tailored — voice consistency across every review
 * matters more than novelty here.
 */
export interface OverallTemplate {
  intro: string;
  conclusion: string;
}

export const OVERALL_TEMPLATES: Record<'pass' | 'fail', OverallTemplate> = {
  pass: {
    intro:
      'Thanks for the contribution — our automated pre-review checks all cleared. This PR is ready for a human maintainer to pick up for functional review.',
    conclusion:
      "Response time varies with the team's bandwidth; if you'd like faster eyes on the PR, feel free to share it on Discord in `#contributing`.",
  },
  fail: {
    intro:
      'Thanks for taking the time to open this PR. Our automated pre-review flagged some items worth addressing before a maintainer takes it further. These are structural checks that help us keep the review queue healthy — not a judgment of the contribution itself or the effort behind it.',
    conclusion:
      "Please address the items above when you get a chance. If any of the feedback feels off, or you'd like to discuss a trade-off, reach out on Discord in `#contributing` and a maintainer will take a look.",
  },
};
