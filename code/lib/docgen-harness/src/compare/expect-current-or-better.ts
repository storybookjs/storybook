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
  | ({ kind: 'snippet' } & CompareSnippetInput & {
        /**
         * Args the candidate is expected to leave out even though the baseline represents them,
         * because their source references a binding a static snippet cannot declare. The candidate
         * records each one in `StoryDoc.warning`, and the runtime keeps its own snippet for readers
         * who need the resolved value.
         *
         * Checked in both directions: an arg listed here that the candidate does represent fails, so
         * the list cannot outlive the gap it documents.
         */
        declaredOmissions?: readonly string[];
      });

/** Throws a single error listing every violation, so a failure shows the whole gap at once. */
export function expectCurrentOrBetter(input: ExpectCurrentOrBetterInput): void {
  if (input.kind === 'argTypes') {
    throwOnViolations(
      compareArgTypes(input.baseline, input.candidate, {
        legacyBaseline: input.legacyBaseline,
        strictTable: input.strictTable,
      })
    );
    return;
  }

  const declaredOmissions = input.declaredOmissions ?? [];
  const violations = compareSnippet(input);
  // An unparsable candidate leaves nothing omitted
  throwOnViolations(violations.filter((v) => v.kind !== 'lost-representation'));

  const omitted = new Set(violations.map((v) => v.arg));
  const stale = declaredOmissions.filter((arg) => !omitted.has(arg));
  if (stale.length > 0) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      `The candidate snippet now represents ${stale.join(', ')} — remove it from declaredOmissions`
    );
  }

  throwOnViolations(violations.filter((v) => !declaredOmissions.includes(v.arg)));
}

function throwOnViolations(violations: Violation[]): void {
  if (violations.length === 0) {
    return;
  }

  const lines = violations.map((v) => `- [${v.kind}] ${v.arg}: ${v.message}`);
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  throw new Error(
    `expectCurrentOrBetter found ${violations.length} violation(s):\n${lines.join('\n')}`
  );
}
