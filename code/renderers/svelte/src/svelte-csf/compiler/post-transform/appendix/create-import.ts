import { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE } from '../../../constants.ts';

import type { ESTreeAST } from '../../../parser/ast.ts';

export function createRuntimeStoriesImport(): ESTreeAST.ImportDeclaration {
  const imported = {
    type: 'Identifier',
    start: 0,
    end: 0,
    // WARN: Tempting to use `createRuntimeStories.name` here.
    // It will break, because this function imports `*.svelte` files.
    name: 'createRuntimeStories',
  } as const;

  return {
    type: 'ImportDeclaration',
    start: 0,
    end: 0,
    source: {
      type: 'Literal',
      value: SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
      start: 0,
      end: 0,
    },
    specifiers: [
      {
        type: 'ImportSpecifier',
        imported,
        local: imported,
        start: 0,
        end: 0,
      },
    ],
    attributes: [],
  };
}
