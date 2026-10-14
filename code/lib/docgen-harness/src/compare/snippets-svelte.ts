import type { SnippetGrammar, Violation } from './types.ts';

interface ParsedSvelteSnippet {
  tag: string;
  names: Set<string>;
  bareAttributes: Set<string>;
}

interface SvelteAttribute {
  name: string;
  bare: boolean;
}

function parseSvelteSnippet(snippet: string): ParsedSvelteSnippet | undefined {
  const root = parseSvelteRoot(snippet);
  if (root === undefined) {
    return undefined;
  }

  const names = new Set<string>();
  const bareAttributes = new Set<string>();
  for (const attribute of parseSvelteAttributes(root.attrText)) {
    names.add(attribute.name);
    if (attribute.bare) {
      bareAttributes.add(attribute.name);
    }
  }
  return { tag: root.tag, names, bareAttributes };
}

function parseSvelteRoot(snippet: string): { tag: string; attrText: string } | undefined {
  const match = /<([A-Z][\w$.]*)\b/.exec(snippet);
  if (match === null) {
    return undefined;
  }

  const attrStart = match.index + match[0].length;
  const attrEnd = findOpenTagEnd(snippet, attrStart);
  if (attrEnd === -1) {
    return undefined;
  }

  const rawAttrText = snippet.slice(attrStart, attrEnd);
  const attrText = rawAttrText.trimEnd().endsWith('/')
    ? rawAttrText.slice(0, rawAttrText.lastIndexOf('/'))
    : rawAttrText;
  return { tag: match[1], attrText };
}

function findOpenTagEnd(snippet: string, start: number): number {
  let braceDepth = 0;
  let quote: '"' | "'" | '`' | undefined;
  for (let index = start; index < snippet.length; index += 1) {
    const char = snippet[index];
    if (quote !== undefined) {
      if (char === quote && !isEscapedQuote(snippet, index)) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === '>' && braceDepth === 0) {
      return index;
    }
  }
  return -1;
}

function parseSvelteAttributes(attrText: string): SvelteAttribute[] {
  const attributes: SvelteAttribute[] = [];
  let cursor = 0;
  while (cursor < attrText.length) {
    cursor = skipWhitespace(attrText, cursor);
    if (cursor >= attrText.length) {
      break;
    }

    if (attrText[cursor] === '{') {
      const shorthand = /^\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(attrText.slice(cursor));
      const spread = /^\{\s*\.\.\./.test(attrText.slice(cursor));
      const end = findBalancedEnd(attrText, cursor, '{', '}');
      if (shorthand !== null && !spread) {
        attributes.push({ name: shorthand[1], bare: false });
      }
      cursor = end === -1 ? attrText.length : end + 1;
      continue;
    }

    const nameStart = cursor;
    while (cursor < attrText.length && !/[\s=/]/.test(attrText[cursor])) {
      cursor += 1;
    }
    const name = attrText.slice(nameStart, cursor);
    cursor = skipWhitespace(attrText, cursor);
    if (attrText[cursor] !== '=') {
      attributes.push({ name, bare: true });
      continue;
    }

    cursor = skipWhitespace(attrText, cursor + 1);
    cursor = skipAttributeValue(attrText, cursor);
    attributes.push({ name, bare: false });
  }
  return attributes;
}

function skipWhitespace(text: string, cursor: number): number {
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function skipAttributeValue(text: string, cursor: number): number {
  const char = text[cursor];
  if (char === '"' || char === "'" || char === '`') {
    const end = findQuotedEnd(text, cursor, char);
    return end === -1 ? text.length : end + 1;
  }
  if (char === '{') {
    const end = findBalancedEnd(text, cursor, '{', '}');
    return end === -1 ? text.length : end + 1;
  }
  while (cursor < text.length && !/\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function findQuotedEnd(text: string, start: number, quote: string): number {
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    if (text[cursor] === quote && !isEscapedQuote(text, cursor)) {
      return cursor;
    }
  }
  return -1;
}

function isEscapedQuote(text: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function findBalancedEnd(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  let quote: '"' | "'" | '`' | undefined;
  for (let cursor = start; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (quote !== undefined) {
      if (char === quote && !isEscapedQuote(text, cursor)) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === open) {
      depth += 1;
      continue;
    }
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }
  }
  return -1;
}

function compareRootStructure(
  baseline: ParsedSvelteSnippet,
  candidate: ParsedSvelteSnippet
): Violation[] {
  const violations: Violation[] = [];
  if (baseline.tag !== candidate.tag) {
    violations.push({
      arg: 'snippet',
      kind: 'changed-root',
      message: `the baseline renders <${baseline.tag}> but the candidate renders <${candidate.tag}>`,
    });
  }
  for (const bareAttribute of [...baseline.bareAttributes].sort()) {
    if (!candidate.names.has(bareAttribute)) {
      violations.push({
        arg: bareAttribute,
        kind: 'lost-attribute',
        message: 'a bare attribute on the baseline root element is missing from the candidate',
      });
    }
  }
  return violations;
}

export const svelteSnippetGrammar: SnippetGrammar<ParsedSvelteSnippet> = {
  parse: parseSvelteSnippet,
  representedNames: (parsed) => parsed.names,
  compareStructure: compareRootStructure,
};
