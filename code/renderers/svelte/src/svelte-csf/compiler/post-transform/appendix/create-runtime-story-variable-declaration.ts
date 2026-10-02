import { STORYBOOK_INTERNAL_PREFIX, SVELTE_CSF_V5_TAG } from '../../../constants.ts';
import {
  createASTArrayExpression,
  createASTIdentifier,
  createASTObjectExpression,
  createASTProperty,
  type ESTreeAST,
} from '../../../parser/ast.ts';

import type { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.ts';

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
  const tags = createASTArrayExpression([
    ...(params.nodes.tags?.elements ?? []),
    { type: 'Literal', value: SVELTE_CSF_V5_TAG },
  ]);

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
