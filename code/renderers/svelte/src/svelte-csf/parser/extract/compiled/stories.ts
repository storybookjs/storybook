import type { CallExpression, ExpressionStatement, Node } from 'estree';
import type { Visitors } from 'zimmerframe';

import type { CompiledASTNodes } from './nodes';

interface Params {
  nodes: CompiledASTNodes;
  filename?: string;
}

type Result = (CallExpression | ExpressionStatement)[];

export async function extractStoriesNodesFromExportDefaultFn(params: Params) {
  const { walk } = await import('zimmerframe');

  const { nodes } = params;
  const { storiesFunctionDeclaration, storyIdentifier } = nodes;
  const state: Result = [];
  const visitors: Visitors<Node, typeof state> = {
    CallExpression(node, context) {
      const { state } = context;

      if (node.callee.type === 'Identifier' && node.callee.name === storyIdentifier.name) {
        state.push(node);
      }
    },
  };

  walk(storiesFunctionDeclaration.body, state, visitors);

  return state;
}
