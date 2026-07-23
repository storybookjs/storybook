import { parseAttributeNames, parseRootElement } from './parse-element.ts';

/**
 * Angular snippets are a single element; `[input]` and `(output)` attributes are the grammar.
 * Attributes are parsed structurally rather than regexed over the whole string, so binding-shaped
 * text inside an attribute VALUE can never count as representation, and quote style or spacing
 * around `=` cannot fail the comparison. Returns undefined when no root element can be found
 * (unparsable for the baseline side is a corpus break, reported by the caller).
 */
export function angularRepresentedNames(snippet: string): Set<string> | undefined {
  const root = parseRootElement(snippet);
  if (root === undefined) {
    return undefined;
  }
  const names = new Set<string>();
  for (const rawName of parseAttributeNames(root.attrText)) {
    const bound = /^\[([\w$.-]+)\]$/.exec(rawName) ?? /^\(([\w$.-]+)\)$/.exec(rawName);
    if (bound) {
      names.add(bound[1]);
    }
  }
  return names;
}
