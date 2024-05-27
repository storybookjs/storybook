import type { Attribute } from 'svelte/compiler';

interface AnalyzeOptions {
  node: Attribute | undefined;
  filename: string;
}

export function getNameFromStoryAttribute(options: AnalyzeOptions) {
  const { node, filename } = options;

  if (!node) {
    throw new Error(
      `Missing attribute 'name' in one of <Story /> component. Stories file: ${filename}`
    );
  }

  return getStringValue({ node, filename });
}

export function getTagsFromStoryAttribute(options: AnalyzeOptions) {
  const { node, filename } = options;

  if (node) {
    return getArrayOfStringsValue({ node, filename });
  }

  return [];
}

interface GetStringValueOptions {
  node: Attribute;
  filename: string;
}

function getStringValue(options: GetStringValueOptions) {
  const { node, filename } = options;

  const { value, name } = node;

  if (value === true) {
    throw new Error(
      `One of <Story> component's attribute '${name}' is not a string value. Stories file: ${filename}`
    );
  }

  if (value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }

  throw new Error(
    `One of <Story> component's attribute '${name}' is not a static string value. Stories file: ${filename}`
  );
}

function getArrayOfStringsValue(options: GetStringValueOptions) {
  const { node, filename } = options;

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
