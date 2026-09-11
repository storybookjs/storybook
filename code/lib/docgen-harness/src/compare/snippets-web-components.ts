import { compareRootStructure, parseAttributes, parseRootElement } from './parse-element.ts';
import type { SnippetGrammar } from './types.ts';

interface ParsedWebComponentsSnippet {
  tag: string;
  attributeNames: Set<string>;
  bareAttributes: Set<string>;
}

function parseWebComponentsSnippet(snippet: string): ParsedWebComponentsSnippet | undefined {
  const root = parseRootElement(snippet);
  if (root === undefined) {
    return undefined;
  }
  const attributeNames = new Set<string>();
  const bareAttributes = new Set<string>();
  for (const { name: rawName, bare } of parseAttributes(root.attrText)) {
    const name = rawName.toLowerCase();
    attributeNames.add(name);
    if (bare) {
      bareAttributes.add(name);
    }
  }
  return { tag: root.tag, attributeNames, bareAttributes };
}

export const webComponentsSnippetGrammar: SnippetGrammar<ParsedWebComponentsSnippet> = {
  parse: parseWebComponentsSnippet,
  representedNames: (parsed) => parsed.attributeNames,
  compareStructure: compareRootStructure,
};
