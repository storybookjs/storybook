import { angularSnippetGrammar } from './snippets-angular.ts';
import { vueRepresentedNames } from './snippets-vue3.ts';
import type { Framework, SnippetGrammar, Violation } from './types.ts';

export interface CompareSnippetInput {
  framework: Framework;
  baseline: string;
  candidate: string;
}

// Vue's represented-name set is the whole parse, so the grammar's two required hooks collapse.
const vue3SnippetGrammar: SnippetGrammar<Set<string>> = {
  parse: vueRepresentedNames,
  representedNames: (names) => names,
};

/**
 * Report every name the baseline snippet represents and the candidate does not.
 *
 * Only which names a snippet represents, never how it formats them: attribute order, whitespace,
 * quote style, and hoisted-vs-inline values cannot fail the comparison. Value fidelity is reviewed
 * through the snapshot diff instead. A framework whose snippet carries more than represented names
 * adds it through its grammar's `compareStructure`.
 */
export function compareSnippet(input: CompareSnippetInput): Violation[] {
  switch (input.framework) {
    case 'angular':
      return compareWithGrammar(angularSnippetGrammar, input);
    case 'vue3':
      return compareWithGrammar(vue3SnippetGrammar, input);
    default: {
      // Adding a member to the Framework union fails compilation here until the new framework's
      // grammar exists.
      const missing: never = input.framework;
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(`No snippet grammar implemented for framework '${String(missing)}'`);
    }
  }
}

function compareWithGrammar<Parsed>(
  grammar: SnippetGrammar<Parsed>,
  { baseline, candidate }: CompareSnippetInput
): Violation[] {
  const parsedBaseline = grammar.parse(baseline);
  if (parsedBaseline === undefined) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      'The baseline snippet has no parsable root element; every committed baseline has one'
    );
  }
  grammar.assertGatable?.(parsedBaseline, 'baseline');

  const parsedCandidate = grammar.parse(candidate);
  if (parsedCandidate === undefined) {
    // Listing every baseline name as lost would read as a pile of dropped bindings rather than
    // one broken snippet, and send the reader hunting in the wrong place.
    return [
      {
        arg: 'snippet',
        kind: 'unparsable-candidate',
        message: 'the candidate snippet has no parsable root element',
      },
    ];
  }
  grammar.assertGatable?.(parsedCandidate, 'candidate');

  const violations = [...(grammar.compareStructure?.(parsedBaseline, parsedCandidate) ?? [])];
  const candidateNames = grammar.representedNames(parsedCandidate);
  for (const name of [...grammar.representedNames(parsedBaseline)].sort()) {
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
