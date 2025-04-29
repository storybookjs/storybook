import type { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';
import { SVELTE_CSF_TAG_PREFIX, SVELTE_CSF_V5_TAG } from '$lib/constants.js';
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

  const tags: ESTreeAST.ArrayExpression = {
    type: 'ArrayExpression',
    elements: params.nodes.tags?.elements ?? [],
  };

  // In legacy stories, the pre-transform will add a SVELTE_CSF_V4_TAG tag.
  // if it is not present, we add the SVELTE_CSF_V5_TAG tag.
  const hasSvelteCsfTag = (tags.elements as ESTreeAST.Literal[]).some((element) =>
    element.value?.toString().startsWith(SVELTE_CSF_TAG_PREFIX)
  );
  if (!hasSvelteCsfTag) {
    tags.elements.push({
      type: 'Literal',
      value: SVELTE_CSF_V5_TAG,
    });
  }

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
