import {
  STORYBOOK_INTERNAL_PREFIX,
  SVELTE_CSF_TAG_PREFIX,
  SVELTE_CSF_V5_TAG,
} from '$lib/constants.js';
import {
  createASTArrayExpression,
  createASTIdentifier,
  createASTObjectExpression,
  createASTProperty,
  type ESTreeAST,
} from '$lib/parser/ast.js';

import type { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';

interface RuntimeStoryVariableDeclarationParams {
  exportName: string;
  filename?: string;
  nodes: {
    variable: ReturnType<typeof createVariableFromRuntimeStoriesCall>;
    tags?: ESTreeAST.ArrayExpression;
  };
}

export function createRuntimeStoryVariableDeclaration(
  params: RuntimeStoryVariableDeclarationParams
): ESTreeAST.VariableDeclaration {
  const tags = createASTArrayExpression(params.nodes.tags?.elements);

  // In legacy stories, the pre-transform will add a SVELTE_CSF_V4_TAG tag.
  // if it is not present, we add the SVELTE_CSF_V5_TAG tag.
  const hasSvelteCsfTag = tags.elements.some(
    (element) =>
      element?.type === 'Literal' && element.value?.toString().startsWith(SVELTE_CSF_TAG_PREFIX)
  );

  if (!hasSvelteCsfTag) {
    tags.elements.push({
      type: 'Literal',
      value: SVELTE_CSF_V5_TAG,
    });
  }

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: createASTIdentifier(`${STORYBOOK_INTERNAL_PREFIX}${params.exportName}`),
        init: createASTObjectExpression([
          {
            type: 'SpreadElement',
            argument: {
              type: 'MemberExpression',
              computed: true,
              optional: false,
              object: params.nodes.variable.declarations[0].id as ESTreeAST.Identifier,
              property: { type: 'Literal', value: params.exportName },
            },
          },
          createASTProperty('tags', tags),
        ]),
      },
    ],
  };
}
