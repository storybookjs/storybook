import type { ESTreeAST } from '$lib/parser/ast.js';
import {
  ArrayElementNotStringError,
  NoArrayExpressionError,
  NoStringLiteralError,
} from '$lib/utils/error/parser/analyse/define-meta.js';

interface GetStringOptions {
  node: ESTreeAST.Property;
  filename: string;
}

export function getPropertyStringValue(options: GetStringOptions) {
  const { node, filename } = options;

  if (node.value.type !== 'Literal') {
    throw new NoStringLiteralError({ filename, property: node });
  }

  const { value } = node.value;

  if (typeof value !== 'string') {
    throw new NoStringLiteralError({ filename, property: node });
  }

  return value;
}

interface GetArrayOfStringOptions {
  node: ESTreeAST.Property;
  filename: string;
}

export function getPropertyArrayOfStringsValue(options: GetArrayOfStringOptions) {
  const { node, filename } = options;

  if (node.value.type !== 'ArrayExpression') {
    throw new NoArrayExpressionError({ filename, property: node });
  }

  const array: string[] = [];

  for (const element of node.value.elements) {
    if (!element || element.type !== 'Literal' || typeof element.value !== 'string') {
      throw new ArrayElementNotStringError({
        filename,
        property: node,
        element,
      });
    }

    array.push(element.value);
  }

  return array;
}
