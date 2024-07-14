import type { Property } from 'estree';

import {
  ArrayElementNotStringError,
  NoArrayExpressionError,
  NoStringLiteralError,
} from '#utils/error/parser/analyse/define-meta';

interface GetStringOptions {
  node: Property;
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
  node: Property;
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
