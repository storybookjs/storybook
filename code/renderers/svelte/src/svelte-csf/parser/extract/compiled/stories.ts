import type { Visitors } from 'zimmerframe';

import type { CompiledASTNodes } from './nodes.ts';

import type { ESTreeAST } from '../../ast.ts';

interface Params {
  nodes: CompiledASTNodes;
  filename?: string;
}

type Result = (ESTreeAST.CallExpression | ESTreeAST.ExpressionStatement)[];

export async function extractStoriesNodesFromExportDefaultFn(params: Params) {
  const { walk } = await import('zimmerframe');

  const { nodes } = params;
  const { storiesFunctionDeclaration, storyNames } = nodes;
  const state: Result = [];
  const visitors: Visitors<ESTreeAST.Node, typeof state> = {
    CallExpression(node, context) {
      const { state } = context;

      if (node.callee.type === 'Identifier' && storyNames.includes(node.callee.name)) {
        state.push(node);
      } else {
        context.next();
      }
    },
  };

  walk(storiesFunctionDeclaration.body, state, visitors);

  return state;
}
