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

/**
 * Append a property to an {@link ESTreeAST.ObjectExpression}.
 * It replaces the array instead of using `push`, because Rollup's parser returns a frozen array for an empty object literal.
 */
export function appendASTProperty(
  node: ESTreeAST.ObjectExpression,
  property: ESTreeAST.ObjectExpression['properties'][number]
): void {
  node.properties = [...node.properties, property];
}

/**
 * Create ESTree compliant AST node for {@link ESTreeAST.Identifier}.
 */
export function createASTIdentifier(name: string): ESTreeAST.Identifier {
  return {
    type: 'Identifier',
    name,
  };
}

interface ExportSpecifierOptions {
  local: string;
  exported?: string;
}
export function createASTExportSpecifier({
  local,
  exported,
}: ExportSpecifierOptions): ESTreeAST.ExportSpecifier {
  return {
    type: 'ExportSpecifier',
    local: createASTIdentifier(local),
    exported: createASTIdentifier(exported ?? local),
  };
}

export type { ESTreeAST, SvelteAST };
