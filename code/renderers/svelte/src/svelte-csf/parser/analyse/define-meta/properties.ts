import { unwrapExpression } from 'storybook/internal/csf-tools';

import type { ESTreeAST } from '../../ast.ts';
import {
  ArrayElementNotStringError,
  NoArrayExpressionError,
  NoStringLiteralError,
} from '../../../utils/error/parser/analyse/define-meta.ts';

interface GetStringOptions {
  node: ESTreeAST.Property;
  filename: string;
}

export function getPropertyStringValue(options: GetStringOptions) {
  const { node, filename } = options;
  const valueNode = unwrapExpression(node.value);

  if (valueNode.type !== 'Literal') {
    throw new NoStringLiteralError({ filename, property: node });
  }

  const { value } = valueNode;

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
  const valueNode = unwrapExpression(node.value);

  if (valueNode.type !== 'ArrayExpression') {
    throw new NoArrayExpressionError({ filename, property: node });
  }

  const array: string[] = [];

  for (const elementNode of valueNode.elements) {
    const element = unwrapExpression(elementNode);
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
