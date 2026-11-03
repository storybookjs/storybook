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
    { type: 'Literal', value: SVELTE_CSF_V5_TAG, start: 0, end: 0 },
  ]);

  const annotations = createASTObjectExpression([
    {
      type: 'SpreadElement',
      start: 0,
      end: 0,
      argument: {
        type: 'MemberExpression',
        computed: true,
        optional: false,
        start: 0,
        end: 0,
        object: params.nodes.variable.declarations[0].id as ESTreeAST.Identifier,
        property: { type: 'Literal', value: params.exportName, start: 0, end: 0 },
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
    start: 0,
    end: 0,
    declarations: [
      {
        type: 'VariableDeclarator',
        start: 0,
        end: 0,
        id: createASTIdentifier(`${STORYBOOK_INTERNAL_PREFIX}${params.exportName}`),
        init: factory
          ? {
              type: 'CallExpression',
              optional: false,
              start: 0,
              end: 0,
              callee: {
                type: 'MemberExpression',
                computed: false,
                optional: false,
                start: 0,
                end: 0,
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
