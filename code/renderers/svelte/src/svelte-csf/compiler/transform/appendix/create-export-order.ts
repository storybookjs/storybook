import type { ExportNamedDeclaration } from 'estree';

import type { getStoriesIdentifiers } from '../../../parser/analyse/story/svelte/attributes/identifiers.js';

interface Params {
  storyIdentifiers: ReturnType<typeof getStoriesIdentifiers>;
  filename?: string;
}

export function createExportOrderVariable(params: Params): ExportNamedDeclaration {
  const { storyIdentifiers } = params;

  const exported = {
    type: 'Identifier',
    name: '__namedExportsOrder',
  } as const;

  return {
    type: 'ExportNamedDeclaration',
    specifiers: [
      {
        type: 'ExportSpecifier',
        local: exported,
        exported,
      },
    ],
    declaration: {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: exported,
          init: {
            type: 'ArrayExpression',
            elements: storyIdentifiers.map(({ exportName }) => ({
              type: 'Literal',
              value: exportName,
            })),
          },
        },
      ],
    },
  };
}
