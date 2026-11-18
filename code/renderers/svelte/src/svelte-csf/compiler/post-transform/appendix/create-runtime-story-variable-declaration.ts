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
  // The story that this story extends, which creates it with `Parent.extend()`
  parentExportName?: string;
  filename?: string;
  nodes: {
    variable: ReturnType<typeof createVariableFromRuntimeStoriesCall>;
    tags?: ESTreeAST.ArrayExpression;
    // The meta of a CSF factories file, which creates the story with `meta.story()`
    factoryMeta?: ESTreeAST.Identifier;
  };
}

export function createRuntimeStoryVariableDeclaration(
  params: RuntimeStoryVariableDeclarationParams
): ESTreeAST.VariableDeclaration {
  const tags = createASTArrayExpression([
    ...(params.nodes.tags?.elements ?? []),
    { type: 'Literal', value: SVELTE_CSF_V5_TAG },
  ]);

  const annotations = createASTObjectExpression([
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
  ]);
  const { factoryMeta } = params.nodes;
  const { parentExportName } = params;
  const factory =
    factoryMeta &&
    (parentExportName
      ? {
          object: createASTIdentifier(`${STORYBOOK_INTERNAL_PREFIX}${parentExportName}`),
          method: 'extend',
        }
      : { object: factoryMeta, method: 'story' });

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: createASTIdentifier(`${STORYBOOK_INTERNAL_PREFIX}${params.exportName}`),
        init: factory
          ? {
              type: 'CallExpression',
              optional: false,
              callee: {
                type: 'MemberExpression',
                computed: false,
                optional: false,
                object: factory.object,
                property: createASTIdentifier(factory.method),
              },
              arguments: [annotations],
            }
          : annotations,
      },
    ],
  };
}
