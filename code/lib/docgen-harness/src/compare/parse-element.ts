// Framework-neutral scanning for a snippet's root element and its attribute names.

// The open tag runs to the first `>` outside quotes; the quoted alternatives absorb `>`, `=`,
// and whitespace so value content can never leak into structure.
const OPEN_TAG = /<([A-Za-z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/;

// An attribute is a name, optionally followed by `=` (spaces tolerated) and a quoted or bare
// value; quoted values are skipped whole, so their content can never read as attribute names.
const ATTRIBUTE = /([^\s=]+)(?:\s*=\s*("[^"]*"|'[^']*'|\S+))?/g;

export interface ParsedAttribute {
  name: string;
  // True for a valueless attribute like `sb-harness-action` (a mangled attribute selector).
  bare: boolean;
}

export function parseRootElement(
  block: string
): { tag: string; attrText: string; childContent: string | undefined } | undefined {
  const match = OPEN_TAG.exec(block);
  if (match === null) {
    return undefined;
  }
  const [tag, name, rawAttrText] = match;
  const selfClosing = rawAttrText.endsWith('/');
  const attrText = selfClosing ? rawAttrText.slice(0, -1) : rawAttrText;
  if (selfClosing) {
    return { tag: name, attrText, childContent: undefined };
  }
  const openEnd = match.index + tag.length;
  const closeIndex = block.lastIndexOf(`</${name}>`);
  return {
    tag: name,
    attrText,
    childContent: closeIndex >= openEnd ? block.slice(openEnd, closeIndex) : undefined,
  };
}

export const parseAttributes = (attrText: string): ParsedAttribute[] =>
  [...attrText.matchAll(ATTRIBUTE)].map((match) => ({
    name: match[1],
    bare: match[2] === undefined,
  }));
