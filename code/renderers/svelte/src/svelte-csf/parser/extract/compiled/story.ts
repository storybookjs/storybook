import type { ESTreeAST } from '../../ast.ts';
import type { extractStoriesNodesFromExportDefaultFn } from './stories.ts';
import { NoCompiledStoryPropsObjectExpression } from '../../../utils/error/parser/extract/compiled.ts';

interface Params {
  node: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
  filename?: string;
}

// Development builds compile a story to `$.validate_component(Story)(node, props)`, production builds to `Story(node, props)`.
export function getStoryPropsObjectExpression(params: Params): ESTreeAST.ObjectExpression {
  const { node, filename } = params;
  if (node.type === 'CallExpression' && node.arguments[1].type === 'ObjectExpression') {
    return node.arguments[1];
  }

  if (
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'CallExpression' &&
    node.expression.arguments[1].type === 'ObjectExpression'
  ) {
    return node.expression.arguments[1];
  }

  throw new NoCompiledStoryPropsObjectExpression(filename);
}
