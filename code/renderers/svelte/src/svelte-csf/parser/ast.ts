import type * as ESTreeAST from 'estree';
import { type AST as SvelteAST, compile } from 'svelte/compiler';

interface GetSvelteASTOptions {
  code: string;
  filename?: string;
}

export function getSvelteAST(options: GetSvelteASTOptions) {
  const { filename, code } = options;
  const { ast }: { ast: SvelteAST.Root } = compile(code, {
    filename,
    modernAst: true,
  });

  return ast;
}

/**
 * Create Svelte compliant AST node for {@link SvelteAST.Attibute} with optional value.
 * By default it will create an shorthand attribute.
 */
export function createASTAttribute(
  name: string,
  value: SvelteAST.Attribute['value'] = true
): SvelteAST.Attribute {
  return {
    type: 'Attribute',
    name,
    value,
  };
}

/**
 * Create Svelte compliant AST node for {@link SvelteAST.ExpressionTag} with optional value.
 * By default it will create an shorthand attribute.
 */
export function createASTExpressionTag(
  expression: SvelteAST.ExpressionTag['expression']
): SvelteAST.ExpressionTag {
  return {
    type: 'ExpressionTag',
    expression,
  };
}

/**
 * Create ESTree compliant AST node for {@link ESTreeAST.Property}
 */
export function createASTProperty(
  name: string,
  value: ESTreeAST.Property['value']
): ESTreeAST.Property {
  return {
    type: 'Property',
    kind: 'init',
    computed: false,
    method: false,
    shorthand: false,
    key: {
      type: 'Identifier',
      name,
    },
    value,
  };
}

/**
 * Create ESTree compliant AST node for {@link ESTreeAST.ArrayExpression} with optional array of elements.
 * By default it will create an empty array.
 */
export function createASTArrayExpression(
  elements: ESTreeAST.ArrayExpression['elements'] = []
): ESTreeAST.ArrayExpression {
  return {
    type: 'ArrayExpression',
    elements,
  };
}

/**
 * Create ESTree compliant AST node for {@link ESTreeAST.ObjectExpression} with optional array of properties.
 * By default it will create an empty object.
 */
export function createASTObjectExpression(
  properties: ESTreeAST.ObjectExpression['properties'] = []
): ESTreeAST.ObjectExpression {
  return {
    type: 'ObjectExpression',
    properties,
  };
}

interface ASTScriptOptions {
  module?: boolean;
  content: SvelteAST.Script['content'];
}
export function createASTScript(options: ASTScriptOptions): SvelteAST.Script {
  const { content, module = false } = options;
  const attributes: SvelteAST.Attribute[] = [];

  if (module) {
    attributes.push(createASTAttribute('module'));
  }

  return {
    type: 'Script',
    context: module ? 'module' : 'default',
    attributes,
    content,
  };
}

export type { ESTreeAST, SvelteAST };
