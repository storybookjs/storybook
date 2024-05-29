import type { VariableDeclaration } from 'estree';

import type { getMetaIdentifier } from '../../../parser/analyse/meta/identifier.js';

interface Params {
  componentName: string;
  metaIdentifier: ReturnType<typeof getMetaIdentifier>;
  filename: string;
}

export function createVariableFromRuntimeStoriesCall(params: Params): VariableDeclaration {
  const { componentName, metaIdentifier } = params;

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: '__stories',
        },
        init: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            // WARN: Tempting to use `createRuntimeStories.name` here.
            // It will break, because this function imports `*.svelte` files.
            name: 'createRuntimeStories',
          },
          arguments: [
            {
              type: 'Identifier',
              name: componentName,
            },
            metaIdentifier,
          ],
          optional: false,
        },
      },
    ],
  };
}
