import type { VariableDeclaration } from 'estree';

import type { getMetaIdentifier } from '../../../parser/analyse/meta/identifier.js';

const STORY_FNS_VARIABLE = '__storyFns';

interface Params {
  componentName: string;
  metaIdentifier: ReturnType<typeof getMetaIdentifier>;
  filename: string;
}

export function createVariableFromStoryFnsCall(params: Params): VariableDeclaration {
  const { componentName, metaIdentifier, filename } = params;

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: STORY_FNS_VARIABLE,
        },
        init: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            // WARN: Tempting to use `createStoryFns.name` here.
            // It will break, because this function imports `*.svelte` files.
            name: 'createStoryFns',
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
