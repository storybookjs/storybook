import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import type { CompareArgTypesOptions } from './argtypes.ts';
import { compareArgTypes } from './argtypes.ts';
import type { CompareSnippetInput } from './snippets.ts';
import { compareSnippet } from './snippets.ts';
import type { Violation } from './types.ts';

export type ExpectCurrentOrBetterInput =
  | ({
      kind: 'argTypes';
      baseline: StrictArgTypes;
      candidate: StrictArgTypes;
    } & CompareArgTypesOptions)
  | ({ kind: 'snippet' } & CompareSnippetInput);

/** Throws a single error listing every violation, so a failure shows the whole gap at once. */
export function expectCurrentOrBetter(input: ExpectCurrentOrBetterInput): void {
  const violations: Violation[] =
    input.kind === 'argTypes'
      ? compareArgTypes(input.baseline, input.candidate, {
          legacyBaseline: input.legacyBaseline,
          strictTable: input.strictTable,
        })
      : compareSnippet(input);
  if (violations.length > 0) {
    const lines = violations.map((v) => `- [${v.kind}] ${v.arg}: ${v.message}`);
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      `expectCurrentOrBetter found ${violations.length} violation(s):\n${lines.join('\n')}`
    );
  }
}
