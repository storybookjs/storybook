import { type ESTree as E, SourceEditor, walk } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const tagOptionRenames = {
  excludeFromSidebar: 'hideFromSidebar',
  excludeFromDocsStories: 'hideFromAutodocs',
} as const;

const objectKeys = (node: E.ObjectExpression) =>
  node.properties.flatMap((property) => {
    if (property.type !== 'Property' || property.computed) {
      return [];
    }
    if (property.key.type === 'Identifier') {
      return [property.key.name];
    }
    if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
      return [property.key.value];
    }
    return [];
  });

const setFilterRenames: Record<string, string> = Object.assign(Object.create(null), {
  experimental_setFilters: 'setFilters',
  experimental_setFilter: 'setFilter',
});

const renameSetFilterIdentifiers = (code: string) => {
  if (!code.includes('experimental_setFilter')) {
    return undefined;
  }
  let editor;
  try {
    editor = new SourceEditor(code);
  } catch {
    return undefined;
  }
  const keys: E.Node[] = [];
  walk(editor.program, (node) => {
    if (node.type === 'MemberExpression' && !node.computed) {
      keys.push(node.property);
    }
    if (node.type === 'ObjectPattern') {
      for (const property of node.properties) {
        if (property.type === 'Property' && !property.computed) {
          keys.push(property.key);
        }
      }
    }
  });
  for (const key of keys) {
    const next =
      key.type === 'Identifier' && Object.hasOwn(setFilterRenames, key.name)
        ? setFilterRenames[key.name]
        : undefined;
    if (next) {
      editor.edits.overwrite(key.start, key.end, next);
    }
  }
  const printed = editor.toString();
  return printed === code ? undefined : printed;
};

export const tagFilterApi: Fix = {
  id: 'tag-filter-api',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#tag-filtering-api',

  prompt: () =>
    `Rename the old tag filter options to ${picocolors.cyan('hideFromSidebar')}, ${picocolors.cyan('hideFromAutodocs')}, and ${picocolors.cyan('setFilter')}`,

  transform: () => [
    {
      filter: { kind: ['main'], code: /excludeFromSidebar|excludeFromDocsStories/ },
      editConfig: (main) => {
        const tags = main.get(['tags']);
        if (tags?.type !== 'ObjectExpression') {
          return;
        }
        for (const tagName of objectKeys(tags)) {
          const option = main.get(['tags', tagName]);
          if (option?.type !== 'ObjectExpression') {
            continue;
          }
          const keys = new Set(objectKeys(option));
          for (const [from, to] of Object.entries(tagOptionRenames)) {
            if (!keys.has(from)) {
              continue;
            }
            if (keys.has(to)) {
              const fromNode = main.get(['tags', tagName, from]);
              const toNode = main.get(['tags', tagName, to]);
              const fromTrue = fromNode?.type === 'Literal' && fromNode.value === true;
              const toTrue = toNode?.type === 'Literal' && toNode.value === true;
              if (fromTrue && !toTrue) {
                main.set(['tags', tagName, to], true);
              }
              main.remove(['tags', tagName, from]);
            } else {
              main.rename(['tags', tagName, from], to);
            }
          }
        }
      },
    },
    {
      filter: {
        kind: ['manager', 'preview', 'story', 'config'],
        code: 'experimental_setFilter',
      },
      handler: renameSetFilterIdentifiers,
    },
  ],
};
