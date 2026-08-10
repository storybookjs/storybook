import { parseAttributes, parseRootElement } from './parse-element.ts';
import type { SnippetGrammar, Violation } from './types.ts';

// A binding name runs to its closing delimiter because an `@Input`/`@Output` alias is an arbitrary
// string: `[attr.xlink:href]`, `[@fadeIn]`, `[style.width.%]` and non-ASCII names must all count.
//
// Parsing reads the ROOT element only, so bindings on child elements would be invisible and silently
// weaken the gate. Every snippet on both sides is single-element today; `assertGatableChildContent`
// breaks the corpus loudly on the first one that is not.
interface ParsedAngularSnippet {
  tag: string;
  // Represented binding names, with `[(x)]` expanded to `x` + `xChange`.
  names: Set<string>;
  // Valueless non-binding attributes, e.g. the mangled attribute-selector marker.
  bareAttributes: Set<string>;
  // Every attribute name on the root element, bindings and plain attributes alike.
  attributeNames: Set<string>;
  childContent: string | undefined;
}

// A binding-shaped attribute: `[...]`, `(...)`, or `[(...)]` followed by `=`.
const CHILD_BINDING_SHAPE = /[[(][^\s=>]*[\])]\s*=/;

function parseAngularSnippet(snippet: string): ParsedAngularSnippet | undefined {
  const root = parseRootElement(snippet);
  if (root === undefined) {
    return undefined;
  }
  const names = new Set<string>();
  const bareAttributes = new Set<string>();
  const attributeNames = new Set<string>();
  for (const { name: rawName, bare } of parseAttributes(root.attrText)) {
    attributeNames.add(rawName);
    const twoWay = /^\[\((.+)\)\]$/.exec(rawName);
    if (twoWay) {
      // [(x)] is sugar for [x] + (xChange), so it represents both names.
      names.add(twoWay[1]);
      names.add(`${twoWay[1]}Change`);
      continue;
    }
    const bound = /^\[(.+)\]$/.exec(rawName) ?? /^\((.+)\)$/.exec(rawName);
    if (bound) {
      names.add(bound[1]);
      continue;
    }
    if (bare) {
      bareAttributes.add(rawName);
    }
  }
  return { tag: root.tag, names, bareAttributes, attributeNames, childContent: root.childContent };
}

function assertGatableChildContent(
  parsed: ParsedAngularSnippet,
  side: 'baseline' | 'candidate'
): void {
  if (parsed.childContent === undefined || !CHILD_BINDING_SHAPE.test(parsed.childContent)) {
    return;
  }
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  throw new Error(
    `The ${side} snippet has binding-shaped attributes in its child content, which the root-only ` +
      'grammar cannot gate; extend the Angular snippet comparison before committing multi-element ' +
      'snippets'
  );
}

// The recorder skips comparison entirely for a first-time snapshot, so the candidate has to be
// checked there too or an ungatable snippet gets committed and only throws on the run after.
export function assertGatableAngularSnippet(snippet: string): void {
  const parsed = parseAngularSnippet(snippet);
  if (parsed !== undefined) {
    assertGatableChildContent(parsed, 'candidate');
  }
}

// An Angular snippet's root element IS the component selector, so unlike the other frameworks its
// comparison gates the root as well as the represented names.
function compareRootElement(
  baseline: ParsedAngularSnippet,
  candidate: ParsedAngularSnippet
): Violation[] {
  const violations: Violation[] = [];
  if (baseline.tag !== candidate.tag) {
    violations.push({
      arg: 'snippet',
      kind: 'changed-root',
      message: `the baseline renders <${baseline.tag}> but the candidate renders <${candidate.tag}>`,
    });
  }
  // Bare attributes carry the mangled attribute-selector part of the component's selector; a
  // candidate may add a value, but dropping the attribute changes which component is matched.
  for (const bareAttribute of [...baseline.bareAttributes].sort()) {
    if (!candidate.attributeNames.has(bareAttribute)) {
      violations.push({
        arg: bareAttribute,
        kind: 'lost-attribute',
        message: 'a bare attribute on the baseline root element is missing from the candidate',
      });
    }
  }
  return violations;
}

export const angularSnippetGrammar: SnippetGrammar<ParsedAngularSnippet> = {
  parse: parseAngularSnippet,
  representedNames: (parsed) => parsed.names,
  assertGatable: assertGatableChildContent,
  compareStructure: compareRootElement,
};
