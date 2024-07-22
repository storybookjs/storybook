import type { ArrayExpression, ObjectExpression, Property } from 'estree';
import {
  compile,
  type Attribute,
  type ExpressionTag,
  type Root,
  type Script,
} from 'svelte/compiler';

interface GetSvelteASTOptions {
  code: string;
  filename?: string;
}

export function getSvelteAST(options: GetSvelteASTOptions) {
  const { filename, code } = options;
  const { ast }: { ast: Root } = compile(code, {
    filename,
    modernAst: true,
  });

  return ast;
}

/**
 * Create Svelte compliant AST node for {@link Attibute} with optional value.
 * By default it will create an shorthand attribute.
 */
export function createASTAttribute(name: string, value: Attribute['value'] = true): Attribute {
  return {
    type: 'Attribute',
    name,
    value,
    // NOTE: Those are useless at this point, but I needed TypeScript to 🤫
    parent: null,
    metadata: {
      delegated: null,
      dynamic: false,
    },
    start: 0,
    end: 0,
  };
}

/**
 * Create Svelte compliant AST node for {@link Attibute} with optional value.
 * By default it will create an shorthand attribute.
 */
export function createASTExpressionTag(expression: ExpressionTag['expression']): ExpressionTag {
  return {
    type: 'ExpressionTag',
    expression,
    // NOTE: Those are useless at this point, but I needed TypeScript to 🤫
    metadata: {
      contains_call_expression: false,
      dynamic: false,
    },
    parent: null,
    start: 0,
    end: 0,
  };
}

/**
 * Create ESTree compliant AST node for {@link Property}
 */
export function createASTProperty(name: string, value: Property['value']): Property {
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
 * Create ESTree compliant AST node for {@link ArrayExpression} with optional array of elements.
 * By default it will create an empty array.
 */
export function createASTArrayExpression(
  elements: ArrayExpression['elements'] = []
): ArrayExpression {
  return {
    type: 'ArrayExpression',
    elements,
  };
}

/**
 * Create ESTree compliant AST node for {@link ObjectExpression} with optional array of properties.
 * By default it will create an empty object.
 */
export function createASTObjectExpression(
  properties: ObjectExpression['properties'] = []
): ObjectExpression {
  return {
    type: 'ObjectExpression',
    properties,
  };
}

interface ASTScriptOptions {
  module?: boolean;
  content: Script['content'];
}
export function createASTScript(options: ASTScriptOptions): Script {
  const { content, module = false } = options;
  const attributes: Attribute[] = [];

  if (module) {
    attributes.push(
      createASTAttribute('context', [
        {
          type: 'Text',
          data: 'module',
          raw: 'module',
          // NOTE: Those are useless at this point, but I needed TypeScript to 🤫
          parent: null,
          start: 0,
          end: 0,
        },
      ])
    );
  }

  return {
    type: 'Script',
    context: module ? 'module' : '',
    attributes,
    content,
    // NOTE: Those are useless at this point, but I needed TypeScript to 🤫
    parent: null,
    start: 0,
    end: 0,
  };
}
