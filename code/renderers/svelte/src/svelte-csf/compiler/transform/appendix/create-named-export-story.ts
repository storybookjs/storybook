import type { ExportNamedDeclaration, Identifier } from 'estree';
import type { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call';

interface Params {
  exportName: string;
  filename: string;
  node: ReturnType<typeof createVariableFromRuntimeStoriesCall>;
}

export async function createNamedExportStory(params: Params): Promise<ExportNamedDeclaration> {
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
  return (node.declarations[0].id as Identifier).name;
}
