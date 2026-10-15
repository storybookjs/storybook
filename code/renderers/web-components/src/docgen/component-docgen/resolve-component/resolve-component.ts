import type { CsfFile } from 'storybook/internal/csf-tools';
import { loadCsf, resolveObjectMembers, unwrapExpression } from 'storybook/internal/csf-tools';
import { recast, types as t } from 'storybook/internal/babel';

import { readFileSync } from 'node:fs';

export type WebComponentsComponentResolution =
  | { tag: string }
  | { reason: 'no-meta-component' }
  | { reason: 'component-not-a-tag'; expression: string }
  | { reason: 'unresolvable-meta-spread'; spread: string };

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
  const expression = expressionFor(node);
  const unwrapped = unwrapExpression(node);
  if (t.isStringLiteral(unwrapped) && unwrapped.value !== '') {
    return { tag: unwrapped.value };
  }
  if (t.isTemplateLiteral(unwrapped) && unwrapped.expressions.length === 0) {
    const tag = unwrapped.quasis[0]?.value.cooked;
    if (tag) {
      return { tag };
    }
  }
  return { reason: 'component-not-a-tag', expression };
}

/**
 * Reads `component` from the meta object, following spreads of objects declared in the story file.
 *
 * @example
 *
 * ```ts
 * const meta = { component: 'x-tabs' } satisfies Meta;
 * export default { ...meta, tags: ['autodocs'] }; // { tag: 'x-tabs' }
 * ```
 */
export function resolveStoryComponent(csf: CsfFile): WebComponentsComponentResolution {
  const members = csf._metaNode
    ? resolveObjectMembers(csf._metaNode, {
        program: csf._file.path,
        filePath: csf._options.fileName ?? '',
      })
    : undefined;
  const component = members?.properties.component;
  if (component) {
    return tagFromNode(component);
  }

  const spread = members?.unresolved.find((source) => source.startsWith('...'));
  return spread ? { reason: 'unresolvable-meta-spread', spread } : { reason: 'no-meta-component' };
}
