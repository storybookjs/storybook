import type { FunctionDeclaration, Identifier, VariableDeclaration } from 'estree';

import type { getMetaIdentifier } from '../../../parser/analyse/define-meta/meta-identifier.js';

interface Params {
  storiesFunctionDeclaration: FunctionDeclaration;
  metaIdentifier: ReturnType<typeof getMetaIdentifier>;
  codeByStoryMapDeclaration: VariableDeclaration;
  filename?: string;
}

export function createVariableFromRuntimeStoriesCall(params: Params): VariableDeclaration {
  const { storiesFunctionDeclaration, metaIdentifier, codeByStoryMapDeclaration } = params;

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
              name: storiesFunctionDeclaration.id.name,
            },
            metaIdentifier,
            {
              type: 'Identifier',
              name: (codeByStoryMapDeclaration.declarations[0].id as Identifier).name,
            },
          ],
          optional: false,
        },
      },
    ],
  };
}
