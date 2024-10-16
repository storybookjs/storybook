import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };

import type { ESTreeAST } from '#parser/ast';

/**
 * The export is defined in the `package.json` export map
 */
export function createRuntimeStoriesImport(): ESTreeAST.ImportDeclaration {
  const imported = {
    type: 'Identifier',
    // WARN: Tempting to use `createRuntimeStories.name` here.
    // It will break, because this function imports `*.svelte` files.
    name: 'createRuntimeStories',
  } as const;

  return {
    type: 'ImportDeclaration',
    source: {
      type: 'Literal',
      value: `${pkg.name}/internal/create-runtime-stories`,
    },
    specifiers: [
      {
        type: 'ImportSpecifier',
        imported,
        local: imported,
      },
    ],
  };
}
