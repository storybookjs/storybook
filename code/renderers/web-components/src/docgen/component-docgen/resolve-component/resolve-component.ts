import {
  type CsfFile,
  type ESTreeNode,
  isStringLiteral,
  loadCsf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { readFileSync } from 'node:fs';

export type WebComponentsComponentResolution =
  | { tag: string }
  | { reason: 'no-meta-component' }
  | { reason: 'component-not-a-tag'; expression: string };

export function parseStoryFile(storyFilePath: string, title: string): CsfFile | undefined {
  try {
    const source = readFileSync(storyFilePath, 'utf8');
    return loadCsf(source, { makeTitle: () => title }).parse();
  } catch {
    return undefined;
  }
}

function tagFromNode(csf: CsfFile, node: ESTreeNode): WebComponentsComponentResolution {
  const unwrapped = unwrapExpression(node);
  if (isStringLiteral(unwrapped) && unwrapped.value !== '') {
    return { tag: unwrapped.value };
  }
  if (unwrapped.type === 'TemplateLiteral' && unwrapped.expressions.length === 0) {
    const tag = unwrapped.quasis[0]?.value.cooked;
    if (tag) {
      return { tag };
    }
  }
  return { reason: 'component-not-a-tag', expression: csf._editor.source(node) };
}

export function resolveStoryComponent(csf: CsfFile): WebComponentsComponentResolution {
  const component = csf._metaAnnotations.component;
  if (!component) {
    return { reason: 'no-meta-component' };
  }

  return tagFromNode(csf, component);
}
