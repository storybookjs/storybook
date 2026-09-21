import type { CsfFile } from 'storybook/internal/csf-tools';
import { loadCsf } from 'storybook/internal/csf-tools';
import { recast, types as t } from 'storybook/internal/babel';

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

const expressionFor = (node: t.Node): string => recast.print(node).code;

function tagFromNode(node: t.Node): WebComponentsComponentResolution {
  if (t.isStringLiteral(node)) {
    return { tag: node.value };
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return { tag: node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? '' };
  }
  return { reason: 'component-not-a-tag', expression: expressionFor(node) };
}

export function resolveStoryComponent(
  storyFilePath: string,
  title = 'Docgen'
): WebComponentsComponentResolution {
  const csf = parseStoryFile(storyFilePath, title);
  const component = csf?._metaAnnotations.component;
  return component ? tagFromNode(component) : { reason: 'no-meta-component' };
}
