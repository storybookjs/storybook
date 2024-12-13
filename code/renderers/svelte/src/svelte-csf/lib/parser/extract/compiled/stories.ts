import type { Visitors } from 'zimmerframe';

import type { CompiledASTNodes } from './nodes';

import type { ESTreeAST } from '$lib/parser/ast';

interface Params {
  nodes: CompiledASTNodes;
  filename?: string;
}

type Result = (ESTreeAST.CallExpression | ESTreeAST.ExpressionStatement)[];

export async function extractStoriesNodesFromExportDefaultFn(params: Params) {
  const { walk } = await import('zimmerframe');

  const { nodes } = params;
  const { storiesFunctionDeclaration, storyIdentifier } = nodes;
  const state: Result = [];
  const visitors: Visitors<ESTreeAST.Node, typeof state> = {
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
