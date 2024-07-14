import type { CallExpression, ExpressionStatement, Node } from 'estree';
import type { Visitors } from 'zimmerframe';

import type { CompiledASTNodes } from './nodes';

interface Params {
  nodes: CompiledASTNodes;
  filename?: string;
}

type Result = (CallExpression | ExpressionStatement)[];

/**
 * WARN: The content of this function body differs in the production/development mode
 */
export async function extractStoriesNodesFromExportDefaultFn(params: Params) {
  const { walk } = await import('zimmerframe');

  const { nodes } = params;
  const { storiesFunctionDeclaration, storyIdentifier } = nodes;
  const state: Result = [];
  const visitors: Visitors<Node, typeof state> = {
    ExpressionStatement(node, { state, next }) {
      if (process.env.NODE_ENV !== 'development') {
        next();
      }

      // 🫠 ... some fun with AST
      // Good to know:
      // I can't split into smaller if-statements,
      // because TypeScript wouldn't understand that `next()` gets out of the currently visited node scope - aka `return;`
      if (
        node.expression.type === 'CallExpression' &&
        node.expression.callee.type === 'CallExpression' &&
        node.expression.callee.callee.type === 'MemberExpression' &&
        node.expression.callee.callee.object.type === 'Identifier' &&
        node.expression.callee.callee.object.name === '$' &&
        node.expression.callee.arguments[0].type === 'Identifier' &&
        node.expression.callee.arguments[0].name === storyIdentifier.name
      ) {
        state.push(node);
      }
    },

    CallExpression(node, { state, next }) {
      if (process.env.NODE_ENV !== 'production') {
        next();
      }

      if (node.callee.type === 'Identifier' && node.callee.name === storyIdentifier.name) {
        state.push(node);
      }
    },
  };

  walk(storiesFunctionDeclaration.body, state, visitors);

  return state;
}
