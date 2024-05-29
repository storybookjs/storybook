import type { Meta } from '@storybook/svelte';
import type { Property } from 'estree';

interface AnalyzePropertyOptions {
  node: Property;
  filename: string;
}

export function getMetaIdValue(options: AnalyzePropertyOptions) {
  return getStringValue({
    propertyName: 'id',
    ...options,
  });
}

export function getMetaTitleValue(options: AnalyzePropertyOptions) {
  return getStringValue({
    propertyName: 'title',
    ...options,
  });
}

export function getMetaTagsValue(options: AnalyzePropertyOptions) {
  return getArrayOfStringsValue({
    propertyName: 'tags',
    ...options,
  });
}

interface GetStringOptions {
  propertyName: keyof Meta;
  node: Property;
  filename: string;
}

function getStringValue(options: GetStringOptions) {
  const { propertyName, node, filename } = options;

  if (node.value.type !== 'Literal') {
    throw new Error(
      `Internal error in extracting meta property - '${propertyName}', expected literal. Stories file: ${filename}`
    );
  }

  const { value } = node.value;

  if (typeof value !== 'string') {
    throw new Error(
      `Internal error in extracting meta property - '${propertyName}', expected string. Stories file: ${filename}`
    );
  }

  return value;
}

interface GetArrayOfStringOptions {
  propertyName: keyof Meta;
  node: Property;
  filename: string;
}

function getArrayOfStringsValue(options: GetArrayOfStringOptions) {
  const { propertyName, node, filename } = options;

  if (node.value.type !== 'ArrayExpression') {
    throw new Error(
      `Internal error in extracting meta property - '${propertyName}', expected array. Stories file: ${filename}`
    );
  }

  const array: string[] = [];

  for (const element of node.value.elements) {
    if (!element || element.type !== 'Literal' || typeof element.value !== 'string') {
      throw new Error(
        `Internal error in extracting meta property - '${propertyName}', one of the array elements wasn't type of string. Stories file: ${filename}`
      );
    }

    array.push(element.value);
  }

  return array;
}
