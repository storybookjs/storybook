import type { Attribute } from 'svelte/compiler';

interface Params {
  node: Attribute | undefined;
  filename?: string;
}

export function getStringValueFromAttribute(params: Params) {
  const { node, filename } = params;

  if (!node) {
    return;
  }

  const { value, name } = node;

  if (value === true) {
    throw new Error(
      `One of '<Story>' component's attribute '${name}' is not a string value. Stories file: ${filename}`
    );
  }

  if (value.length !== 1) {
    throw new Error(
      `Expected a string value from '<Story>' attribute '${name}'. Stories file: ${filename}`
    );
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

  throw new Error(
    `One of <Story> component's attribute '${name}' is not a static string value. Stories file: ${filename}`
  );
}

export function getArrayOfStringsValue(params: Params) {
  const { node, filename } = params;

  if (!node) {
    return [];
  }

  const { value, name } = node;

  if (value === true) {
    throw new Error(
      `One of <Story> component's attribute '${name}' is not an array of strings value. Stories file: ${filename}`
    );
  }

  if (
    value.length !== 1 ||
    value[0].type !== 'ExpressionTag' ||
    value[0].expression.type !== 'ArrayExpression'
  ) {
    throw new Error(
      `<Story> attribute '${name}' must be an expression tag with an array of strings. Stories file: ${filename}`
    );
  }

  const arrayOfStrings: string[] = [];

  for (const element of value[0].expression.elements) {
    if (element?.type !== 'Literal' || typeof element.value !== 'string') {
      throw new Error(
        `<Story> attribute '${name}' must be an array of strings. Stories file: ${filename}`
      );
    }

    arrayOfStrings.push(element.value);
  }

  return arrayOfStrings;
}
