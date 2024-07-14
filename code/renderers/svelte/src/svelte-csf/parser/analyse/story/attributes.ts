import type { Attribute, Component } from 'svelte/compiler';

import {
  AttributeNotArrayError,
  AttributeNotArrayOfStringsError,
  AttributeNotStringError,
} from '#utils/error/parser/analyse/story';

interface Params {
  node: Attribute | undefined;
  filename?: string;
  component: Component;
}

export function getStringValueFromAttribute(params: Params) {
  const { node, filename, component } = params;

  if (!node) {
    return;
  }

  const { value } = node;

  if (value === true || value.length !== 1) {
    throw new AttributeNotStringError({ filename, component, attribute: node });
  }

  if (value[0].type === 'Text') {
    return value[0].data;
  }

  if (
    value[0].type === 'ExpressionTag' &&
    value[0].expression.type === 'Literal' &&
    typeof value[0].expression.value === 'string'
  ) {
    return value[0].expression.value;
  }

  throw new AttributeNotStringError({ filename, component, attribute: node });
}

export function getArrayOfStringsValueFromAttribute(params: Params) {
  const { node, filename, component } = params;

  if (!node) {
    return [];
  }

  const { value } = node;

  if (
    value === true ||
    value.length !== 1 ||
    value[0].type !== 'ExpressionTag' ||
    value[0].expression.type !== 'ArrayExpression'
  ) {
    throw new AttributeNotArrayError({
      component,
      filename,
      attribute: node,
    });
  }

  const arrayOfStrings: string[] = [];

  for (const element of value[0].expression.elements) {
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
