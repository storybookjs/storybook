import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import { createASTObjectExpression, type ESTreeAST, type SvelteAST } from '../../../parser/ast.ts';

interface FindPropertyOptions {
  name: string;
  node: ESTreeAST.ObjectExpression;
  filename?: string;
  component?: SvelteAST.Component;
}

export function findASTPropertyIndex(options: FindPropertyOptions) {
  const { node, name } = options;

  return node.properties.findIndex(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
  );
}

export const findPropertyParametersIndex = (options: Omit<FindPropertyOptions, 'name'>) => {
  return findASTPropertyIndex({
    ...options,
    name: 'parameters',
  });
};

const getParametersProperty = (options: Omit<FindPropertyOptions, 'name'>) => {
  const { node } = options;

  return node.properties[findPropertyParametersIndex(options)] as ESTreeAST.Property;
};

export const getParametersPropertyValue = (
  options: Omit<FindPropertyOptions, 'name'>
): ESTreeAST.ObjectExpression => {
  const { filename, component } = options;
  const property = getParametersProperty(options);

  // Svelte compiles a `parameters` prop on `<Story>` to a getter. Rewriting it as `parameters: { ...value }`
  // lets entries be appended, but evaluates the value once instead of on each read.
  if (
    property.kind === 'get' &&
    property.value.type === 'FunctionExpression' &&
    property.value.body.body[0].type === 'ReturnStatement'
  ) {
    const properties: ESTreeAST.ObjectExpression['properties'] = [];
    if (property.value.body.body[0].argument) {
      properties.push({
        type: 'SpreadElement',
        argument: property.value.body.body[0].argument,
      });
    }

    property.kind = 'init';
    property.value = createASTObjectExpression(properties);
  }

  if (property.value.type !== 'ObjectExpression') {
    logger.warn(dedent`
      Svelte CSF:
        Could not access 'parameters' of ${component ? "Story's prop" : 'defineMeta'}}.
        Expected value to be an object expression.
        Instead it was '${property.value.type}', in: 
        ${filename}
        Property:
        ${JSON.stringify(property, null, 2)}
    `);
    // NOTE: We're emitting a warning when it happens
    return undefined as never;
  }

  // Rollup's parser returns a frozen `properties` array for an empty object literal, so copy it before appending.
  if (!Object.isExtensible(property.value.properties)) {
    property.value.properties = Array.from(property.value.properties);
  }

  return property.value;
};

export const findPropertyDocsIndex = (options: Omit<FindPropertyOptions, 'name'>) => {
  return findASTPropertyIndex({
    ...options,
    name: 'docs',
    node: getParametersPropertyValue(options),
  });
};

const getDocsProperty = (options: Omit<FindPropertyOptions, 'name'>) => {
  return getParametersPropertyValue(options).properties[
    findPropertyDocsIndex(options)
  ] as ESTreeAST.Property;
};

export const getDocsPropertyValue = (options: Omit<FindPropertyOptions, 'name'>) => {
  const { filename, component } = options;
  const property = getDocsProperty(options);
  const { value } = property;

  if (value.type !== 'ObjectExpression') {
    logger.warn(dedent`
      Svelte CSF:
        Could not access 'parameters.docs' of ${component ? "Story's prop" : 'defineMeta'}}.
        Expected value to be an object expression.
        Instead it was '${property.value.type}', in: 
        ${filename}
        Property:
        ${JSON.stringify(property, null, 2)}
    `);
    // NOTE: We're emitting a warning when it happens
    return undefined as never;
  }

  return value;
};

export const findPropertyDescriptionIndex = (options: Omit<FindPropertyOptions, 'name'>) => {
  return findASTPropertyIndex({
    ...options,
    name: 'description',
    node: getDocsPropertyValue(options),
  });
};

const getDescriptionProperty = (options: Omit<FindPropertyOptions, 'name'>) => {
  return getDocsPropertyValue(options).properties[
    findPropertyDescriptionIndex(options)
  ] as ESTreeAST.Property;
};

export const getDescriptionPropertyValue = (options: Omit<FindPropertyOptions, 'name'>) => {
  const { filename, component } = options;
  const property = getDescriptionProperty(options);
  const { value } = property;

  if (value.type !== 'ObjectExpression') {
    logger.warn(dedent`
      Svelte CSF:
        Could not access 'parameters.docs.description' of ${component ? "Story's prop" : 'defineMeta'}}.
        Expected value to be an object expression.
        Instead it was '${property.value.type}', in: 
        ${filename}
        Property:
        ${JSON.stringify(property, null, 2)}
    `);
    // NOTE: We're emitting a warning when it happens
    return undefined as never;
  }

  return value;
};
