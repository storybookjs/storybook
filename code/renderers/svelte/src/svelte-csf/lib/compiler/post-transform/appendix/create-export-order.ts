import type { getStoriesIdentifiers } from '$lib/parser/analyse/story/attributes/identifiers';
import type { ESTreeAST } from '$lib/parser/ast';

interface Params {
  storyIdentifiers: ReturnType<typeof getStoriesIdentifiers>;
  filename?: string;
}

export function createExportOrderVariable(params: Params): ESTreeAST.ExportNamedDeclaration {
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
