import type { ExportNamedDeclaration } from 'estree';

import type { getStoriesIdentifiers } from '../../../parser/analyse/story/svelte/attributes/identifiers.js';

const EXPORT_ORDER_VARIABLE = '__namedExportsOrder';

interface Params {
  storyIdentifiers: ReturnType<typeof getStoriesIdentifiers>;
  filename?: string;
}

export function createExportOrderVariable(params: Params): ExportNamedDeclaration {
  const { storyIdentifiers } = params;

  return {
    type: 'ExportNamedDeclaration',
    specifiers: [
      {
        type: 'ExportSpecifier',
        local: {
          type: 'Identifier',
          name: EXPORT_ORDER_VARIABLE,
        },
        exported: {
          type: 'Identifier',
          name: EXPORT_ORDER_VARIABLE,
        },
      },
    ],
    declaration: {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: EXPORT_ORDER_VARIABLE,
          },
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
