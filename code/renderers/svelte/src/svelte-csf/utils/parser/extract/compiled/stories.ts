import type { CallExpression, Node } from 'estree';

import type { CompiledASTNodes } from './nodes.js';
import type { Visitors } from 'zimmerframe';

interface Params {
  nodes: CompiledASTNodes;
  filename: string;
}

type Result = CallExpression[];

export async function extractStoriesNodesFromExportDefaultFn(params: Params) {
  const { walk } = await import('zimmerframe');

  const { nodes, filename } = params;
  const { storiesFunctionDeclaration, storyIdentifier } = nodes;
  const state: Result = [];
  const visitors: Visitors<Node, typeof state> = {
    CallExpression(node, { state }) {
      if (node.callee.type === 'Identifier' && node.callee.name === storyIdentifier.name) {
        state.push(node);
      }
    },
  };

  walk(storiesFunctionDeclaration, state, visitors);

  return state;
}
