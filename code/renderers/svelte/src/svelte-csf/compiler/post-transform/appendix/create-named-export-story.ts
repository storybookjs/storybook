import type { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';
import { SVELTE_CSF_TAG } from '$lib/constants.js';
import type { ESTreeAST } from '$lib/parser/ast.js';

interface Params {
  exportName: string;
  filename?: string;
  nodes: {
    variable: ReturnType<typeof createVariableFromRuntimeStoriesCall>;
    tags?: ESTreeAST.ArrayExpression;
  };
}

export function createNamedExportStory(params: Params): ESTreeAST.ExportNamedDeclaration {
  const exported = {
    type: 'Identifier',
    name: params.exportName,
  } as const;

  const defaultTags: ESTreeAST.ArrayExpression = {
    type: 'ArrayExpression',
    elements: [
      {
        type: 'Literal',
        value: SVELTE_CSF_TAG,
      },
    ],
  };

  const tags = params.nodes.tags
    ? {
        ...defaultTags,
        elements: [...params.nodes.tags.elements, ...defaultTags.elements],
      }
    : defaultTags;

  const declarations = [
    {
      type: 'VariableDeclarator',
      id: exported,
      init: {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'SpreadElement',
            argument: {
              type: 'MemberExpression',
              computed: true,
              optional: false,
              object: {
                type: 'Identifier',
                name: getNameFromVariable(params.nodes),
              },
              property: { type: 'Literal', value: params.exportName },
            },
          },
          {
            type: 'Property',
            kind: 'init',
            computed: false,
            method: false,
            shorthand: false,
            key: {
              type: 'Identifier',
              name: 'tags',
            },
            value: tags,
          },
        ],
      },
    },
  ] satisfies ESTreeAST.VariableDeclaration['declarations'];

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
      declarations,
    },
  };
}

function getNameFromVariable(nodes: Params['nodes']): string {
  return (nodes.variable.declarations[0].id as ESTreeAST.Identifier).name;
}
