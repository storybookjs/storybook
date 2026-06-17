import type { CheckId } from './types.ts';

/**
 * Per-criterion canned response templates. The synthesis LLM call uses these
 * as a starting point and tailors them with PR-specific specifics (the LLM is
 * instructed to *start from the canned template and adapt*, never to invent
 * new wording from scratch — this keeps the assessment voice consistent).
 *
 * Final copy is a follow-up: the templates here are placeholders until the
 * author transcribes the vision-doc copy. See spec section 12 TODO.
 */
export const CANNED: Record<CheckId, string> = {
  human: 'TODO(copy): explain that MVC review is only run on human-authored PRs.',
  'real-problem': 'TODO(copy): coach the author on linking an open issue that this PR addresses.',
  duplicate: 'TODO(copy): coach the author when another PR already addresses the same issue.',
  'cost-benefit':
    'TODO(copy): explain the cost/benefit reasoning and suggest narrowing or addon scope.',
  'explains-test': 'TODO(copy): ask for reproducible third-party test instructions.',
  'provides-context': 'TODO(copy): ask for a short "Why" rationale.',
};

export const OVERALL = {
  pass: 'TODO(copy): friendly confirmation that the PR meets MVC; reviewer queue follows.',
  fail: 'TODO(copy): constructive frame — automation identified ways to improve; not a personal judgment.',
};
