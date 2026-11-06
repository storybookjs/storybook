import { unwrapExpression } from 'storybook/internal/csf-tools';

import type { ESTreeAST, SvelteAST } from '../../ast.ts';
import {
  AttributeNotArrayError,
  AttributeNotArrayOfStringsError,
  AttributeNotStringError,
} from '../../../utils/error/parser/analyse/story.ts';

interface Params {
  node: SvelteAST.Attribute | undefined;
  filename?: string;
  component: SvelteAST.Component;
}

// Returns the value of a static attribute. A single `{literal}` expression returns the literal's
// value as is, which isn't always a string (for example `exportName={null}`).
export function getLiteralValueFromAttribute(
  params: Params
): ESTreeAST.Literal['value'] | undefined {
  const { node, filename, component } = params;

  if (!node) {
    return;
  }

  const { value } = node;

  if (value === true) {
    throw new AttributeNotStringError({ filename, component, attribute: node });
  }

  if (!Array.isArray(value)) {
    const expression = unwrapExpression(value.expression);

    if (expression.type === 'Literal') {
      return expression.value;
    }

    throw new AttributeNotStringError({ filename, component, attribute: node });
  }

  const [first] = value;

  if (first.type === 'Text') {
    return first.data;
  }

  const expression = unwrapExpression(first.expression);

  if (expression.type === 'Literal' && typeof expression.value === 'string') {
    return expression.value;
  }

  throw new AttributeNotStringError({ filename, component, attribute: node });
}

export function getStringValueFromAttribute(params: Params): string | undefined {
  const { node, filename, component } = params;

  if (!node) {
    return;
  }

  const value = getLiteralValueFromAttribute(params);

  if (typeof value !== 'string') {
    throw new AttributeNotStringError({ filename, component, attribute: node });
  }

  return value;
}

export function getArrayOfStringsValueFromAttribute(params: Params) {
  const { node, filename, component } = params;

  if (!node) {
    return [];
  }

  const { value } = node;

  if (value === true) {
    throw new AttributeNotArrayError({
      component,
      filename,
      attribute: node,
    });
  }

  // value is SvelteAST.ExpressionTag
  if (!Array.isArray(value)) {
    const expression = unwrapExpression(value.expression);

    if (expression.type !== 'ArrayExpression') {
      throw new AttributeNotArrayError({
        component,
        filename,
        attribute: node,
      });
    }

    const arrayOfStrings: string[] = [];

    for (const elementNode of expression.elements) {
      const element = unwrapExpression(elementNode);

      if (element?.type !== 'Literal' || typeof element.value !== 'string') {
        throw new AttributeNotArrayOfStringsError({
          filename,
          component,
          attribute: node,
          element,
        });
      }

      arrayOfStrings.push(element.value);
    }

    return arrayOfStrings;
  }

  // A quoted value, such as `tags="{['a']}"`, parses as an array of text and expression tags
  const [first] = value;
  const expression = first.type === 'ExpressionTag' ? unwrapExpression(first.expression) : first;

  if (expression.type !== 'ArrayExpression') {
    throw new AttributeNotArrayError({
      component,
      filename,
      attribute: node,
    });
  }

  const arrayOfStrings: string[] = [];

  for (const elementNode of expression.elements) {
    const element = unwrapExpression(elementNode);

    if (element?.type !== 'Literal' || typeof element.value !== 'string') {
      throw new AttributeNotArrayOfStringsError({
        filename,
        component,
        attribute: node,
        element,
      });
    }

    arrayOfStrings.push(element.value);
  }

  return arrayOfStrings;
}
