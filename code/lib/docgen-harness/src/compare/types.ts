export type Framework = 'vue3' | 'angular';

export type ViolationKind =
  | 'lost-arg'
  | 'lost-description'
  | 'lost-default'
  | 'lost-type'
  | 'lost-summary'
  | 'changed-summary'
  | 'lost-required'
  | 'type-fidelity'
  | 'lost-representation'
  | 'changed-root'
  | 'lost-attribute'
  | 'unparsable-candidate';

export interface Violation {
  arg: string;
  kind: ViolationKind;
  message: string;
}

// One framework's snippet grammar. Represented names are the comparison every framework shares; the
// optional hooks carry what only some of them have, so the pipeline in snippets.ts stays single.
export interface SnippetGrammar<Parsed> {
  parse(snippet: string): Parsed | undefined;
  representedNames(parsed: Parsed): Set<string>;
  // Runs on each side as soon as it parses, so an ungatable snippet is reported against its own side.
  assertGatable?(parsed: Parsed, side: 'baseline' | 'candidate'): void;
  // Violations beyond represented names, e.g. an Angular snippet's root element identity.
  compareStructure?(baseline: Parsed, candidate: Parsed): Violation[];
}
