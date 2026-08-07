import { parseAttributes, parseRootElement } from './parse-element.ts';
import type { Violation } from './types.ts';

/**
 * Angular snippets are a single element; `[input]` and `(output)` attributes are the grammar.
 * Attributes are parsed structurally rather than regexed over the whole string, so binding-shaped
 * text inside an attribute VALUE can never count as representation, and quote style or spacing
 * around `=` cannot fail the comparison. Binding names run to the closing delimiter, because an
 * `@Input`/`@Output` alias is an arbitrary string: `[attr.xlink:href]`, `[@fadeIn]`,
 * `(@fadeIn.done)`, `[style.width.%]`, and non-ASCII names must all count.
 */
interface ParsedAngularSnippet {
  tag: string;
  /** Represented binding names, with `[(x)]` expanded to `x` + `xChange`. */
  names: Set<string>;
  /** Valueless non-binding attributes, e.g. the mangled attribute-selector marker. */
  bareAttributes: Set<string>;
  /** Every attribute name on the root element, bindings and plain attributes alike. */
  attributeNames: Set<string>;
  childContent: string | undefined;
}

// A binding-shaped attribute: `[...]`, `(...)`, or `[(...)]` followed by `=`. Used to break the
// corpus loudly when a baseline's child content carries bindings the root-only grammar would skip.
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

/**
 * The grammar only reads the ROOT element, so baseline bindings on child elements would be
 * invisible and silently weaken the gate. All committed baselines are single-element today; the
 * first multi-element baseline must break the corpus loudly instead.
 */
export function compareAngularSnippet(baseline: string, candidate: string): Violation[] {
  const parsedBaseline = parseAngularSnippet(baseline);
  if (parsedBaseline === undefined) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      'The baseline snippet has no parsable root element; every committed baseline has one'
    );
  }
  if (
    parsedBaseline.childContent !== undefined &&
    CHILD_BINDING_SHAPE.test(parsedBaseline.childContent)
  ) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      'The baseline snippet has binding-shaped attributes in its child content, which the ' +
        'root-only grammar cannot gate; extend the Angular snippet comparison before committing ' +
        'multi-element baselines'
    );
  }
  const parsedCandidate = parseAngularSnippet(candidate);
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
  const violations: Violation[] = [];
  if (parsedBaseline.tag !== parsedCandidate.tag) {
    violations.push({
      arg: 'snippet',
      kind: 'changed-root',
      message: `the baseline renders <${parsedBaseline.tag}> but the candidate renders <${parsedCandidate.tag}>`,
    });
  }
  // Bare attributes carry the mangled attribute-selector part of the component's selector; a
  // candidate may add a value, but dropping the attribute changes which component is matched.
  for (const bareAttribute of [...parsedBaseline.bareAttributes].sort()) {
    if (!parsedCandidate.attributeNames.has(bareAttribute)) {
      violations.push({
        arg: bareAttribute,
        kind: 'lost-attribute',
        message: 'a bare attribute on the baseline root element is missing from the candidate',
      });
    }
  }
  for (const name of [...parsedBaseline.names].sort()) {
    if (!parsedCandidate.names.has(name)) {
      violations.push({
        arg: name,
        kind: 'lost-representation',
        message: 'represented in the baseline snippet but not in the candidate',
      });
    }
  }
  return violations;
}
