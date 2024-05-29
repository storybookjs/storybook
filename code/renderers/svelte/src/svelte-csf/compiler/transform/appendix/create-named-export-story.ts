import type { ExportNamedDeclaration, Identifier } from 'estree';
import type { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call';

import { storyNameToExportName, storyNameToId } from '../../../utils/identifiers.js';

interface Params {
  name: string;
  filename: string;
  node: ReturnType<typeof createVariableFromRuntimeStoriesCall>;
}

export async function createNamedExportStory(params: Params): Promise<ExportNamedDeclaration> {
  const { name, node } = params;

  const exported = {
    type: 'Identifier',
    name: storyNameToExportName(name),
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
            property: { type: 'Literal', value: storyNameToId(name) },
          },
        },
      ],
    },
  };
}

function getNameFromVariable(node: Params['node']): string {
  return (node.declarations[0].id as Identifier).name;
}
