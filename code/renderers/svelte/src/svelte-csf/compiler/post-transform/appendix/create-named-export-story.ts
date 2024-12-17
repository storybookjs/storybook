import type { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';

import type { ESTreeAST } from '$lib/parser/ast.js';

interface Params {
  exportName: string;
  filename?: string;
  node: ReturnType<typeof createVariableFromRuntimeStoriesCall>;
}

export function createNamedExportStory(params: Params): ESTreeAST.ExportNamedDeclaration {
  const { exportName, node } = params;

  const exported = {
    type: 'Identifier',
    name: exportName,
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
            type: 'MemberExpression',
            computed: true,
            optional: false,
            object: {
              type: 'Identifier',
              name: getNameFromVariable(node),
            },
            property: { type: 'Literal', value: exportName },
          },
        },
      ],
    },
  };
}

function getNameFromVariable(node: Params['node']): string {
  return (node.declarations[0].id as ESTreeAST.Identifier).name;
}
