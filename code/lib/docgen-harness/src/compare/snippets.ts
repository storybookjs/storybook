import { angularRepresentedNames } from './snippets-angular.ts';
import { vueRepresentedNames } from './snippets-vue3.ts';
import type { Framework, Violation } from './types.ts';

export interface CompareSnippetInput {
  framework: Framework;
  args: Record<string, unknown>;
  baseline: string;
  candidate: string;
}

/**
 * Compares which names a snippet represents, never how it formats them: represented-name sets are
 * insensitive to attribute order, whitespace, quote style, and hoisted-vs-inline values by
 * construction. A name represented in the baseline but not the candidate is a violation; a
 * candidate-only representation is an improvement; a declared arg absent from both sides is an
 * accepted delta the committed baseline encodes (e.g. Vue drops function args). Value fidelity is
 * reviewed through the snapshot diff, not compared here.
 */
export function compareSnippet(input: CompareSnippetInput): Violation[] {
  const baselineNames = representedNames(input.framework, input.baseline);
  if (baselineNames === undefined) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      'The baseline snippet has no parsable root element; every committed baseline has one'
    );
  }
  const candidateNames = representedNames(input.framework, input.candidate) ?? new Set<string>();
  const violations: Violation[] = [];
  for (const name of [...baselineNames].sort()) {
    if (!candidateNames.has(name)) {
      violations.push({
        arg: name,
        kind: 'lost-representation',
        message: 'represented in the baseline snippet but not in the candidate',
      });
    }
  }
  return violations;
}

/** Every framework brings its own snippet grammar; the matchers live in snippets-<framework>.ts. */
function representedNames(framework: Framework, snippet: string): Set<string> | undefined {
  switch (framework) {
    case 'vue3':
      return vueRepresentedNames(snippet);
    case 'angular':
      return angularRepresentedNames(snippet);
    default: {
      // Adding a member to the Framework union fails compilation here until the new
      // framework's represented-names matcher exists.
      const missing: never = framework;
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(`No snippet matcher implemented for framework '${String(missing)}'`);
    }
  }
}
