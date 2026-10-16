import { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE } from '../../../constants.ts';

import type { ESTreeAST } from '../../../parser/ast.ts';

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
      value: SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
    },
    specifiers: [
      {
        type: 'ImportSpecifier',
        imported,
        local: imported,
      },
    ],
    attributes: [],
  };
}
