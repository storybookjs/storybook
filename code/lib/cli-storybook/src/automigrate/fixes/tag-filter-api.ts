import { babelParse, babelPrint, traverse } from 'storybook/internal/babel';
import type { CsfValue } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const tagOptionRenames = {
  excludeFromSidebar: 'hideFromSidebar',
  excludeFromDocsStories: 'hideFromAutodocs',
} as const;

const isRecord = (value: CsfValue): value is Record<string, CsfValue> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const setFilterRenames: Record<string, string> = {
  experimental_setFilters: 'setFilters',
  experimental_setFilter: 'setFilter',
};

const renameSetFilterIdentifiers = (code: string) => {
  if (!code.includes('experimental_setFilter')) {
    return undefined;
  }
  let ast;
  try {
    ast = babelParse(code);
  } catch {
    return undefined;
  }
  let changed = false;
  traverse(ast, {
    Identifier(path) {
      const next = setFilterRenames[path.node.name];
      if (!next) {
        return;
      }
      path.node.name = next;
      changed = true;
    },
  });
  if (!changed) {
    return undefined;
  }
  const printed = babelPrint(ast);
  return printed === code ? undefined : printed;
};

export const tagFilterApi: Fix = {
  id: 'tag-filter-api',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#tag-filtering-api',

  prompt: () =>
    `Rename deprecated tag filter options to ${picocolors.cyan('hideFromSidebar')}, ${picocolors.cyan('hideFromAutodocs')}, and ${picocolors.cyan('setFilter')}`,

  transform: () => [
    {
      filter: { kind: ['main'], code: /excludeFromSidebar|excludeFromDocsStories/ },
      editConfig: (main) => {
        const tags = main.getValue(['tags']);
        if (!isRecord(tags)) {
          return;
        }
        for (const tagName of Object.keys(tags)) {
          const option = tags[tagName];
          if (!isRecord(option)) {
            continue;
          }
          for (const [from, to] of Object.entries(tagOptionRenames)) {
            if (!(from in option)) {
              continue;
            }
            if (to in option) {
              if (option[from] === true && option[to] !== true) {
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
