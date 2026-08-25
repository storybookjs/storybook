import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import type { CompareArgTypesOptions } from './argtypes.ts';
import { compareArgTypes } from './argtypes.ts';
import type { CompareSnippetInput } from './snippets.ts';
import { compareSnippet } from './snippets.ts';
import type { Violation } from './types.ts';

export interface DeclaredDefaultOmission {
  arg: string;
  expectedSummary: string;
}

export type ArgTypesComparisonOptions =
  | (CompareArgTypesOptions & { declaredDefaultOmissions?: undefined })
  | {
      legacyBaseline: true;
      strictTable?: boolean;
      /**
       * Args whose legacy default recordings are known initializer source rather than displayable
       * values. Each declaration must match a `lost-default` violation and is checked for staleness.
       */
      declaredDefaultOmissions: readonly DeclaredDefaultOmission[];
    };

export type ExpectCurrentOrBetterInput =
  | ({
      kind: 'argTypes';
      baseline: StrictArgTypes;
      candidate: StrictArgTypes;
    } & ArgTypesComparisonOptions)
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
    const violations = compareArgTypes(input.baseline, input.candidate, {
      legacyBaseline: input.legacyBaseline,
      strictTable: input.strictTable,
    });
    const declaredDefaultOmissions = input.declaredDefaultOmissions ?? [];
    if (input.declaredDefaultOmissions !== undefined && input.legacyBaseline !== true) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error('declaredDefaultOmissions may only waive legacy Angular baselines');
    }
    const mismatched = declaredDefaultOmissions.filter(
      ({ arg, expectedSummary }) =>
        input.baseline[arg]?.table?.defaultValue?.summary !== expectedSummary
    );
    if (mismatched.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        `Legacy default summaries changed for ${mismatched.map(({ arg }) => arg).join(', ')} — update or remove their declaredDefaultOmissions`
      );
    }
    const declaredArgs = new Set(declaredDefaultOmissions.map(({ arg }) => arg));
    throwOnViolations(
      violations.filter(
        (violation) => violation.kind !== 'lost-default' || !declaredArgs.has(violation.arg)
      )
    );

    const omittedDefaults = new Set(
      violations
        .filter((violation) => violation.kind === 'lost-default')
        .map((violation) => violation.arg)
    );
    const stale = declaredDefaultOmissions.filter(({ arg }) => !omittedDefaults.has(arg));
    if (stale.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        `The candidate argTypes now record defaults for ${stale.map(({ arg }) => arg).join(', ')} — remove them from declaredDefaultOmissions`
      );
    }
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
