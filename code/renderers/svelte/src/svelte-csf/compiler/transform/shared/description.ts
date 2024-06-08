import type { ObjectExpression, Property } from 'estree';

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
 * Create ESTree compliant AST node for {@link ObjectExpression} with optional array of properties.
 * By default it will create an enpty object.
 */
export function createASTObjectExpression(
  properties: ObjectExpression['properties'] = []
): ObjectExpression {
  return {
    type: 'ObjectExpression',
    properties,
  };
}

/**
 * In order to be able to acces AST node - {@link Property} - from the {@link ObjectExpression},
 * we need to have its index based on the property name, so the key must be an identifier.
 * NOTE: Reminder, it always returns a number and `-1` means not found.
 */
export function findASTPropertyIndex(name: string, node: ObjectExpression) {
  return node.properties.findIndex(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
  );
}

export const findPropertyParametersIndex = (node: ObjectExpression) =>
  findASTPropertyIndex('parameters', node);

export const getParametersProperty = (node: ObjectExpression) =>
  node.properties[findPropertyParametersIndex(node)] as Property;

export const getParametersPropertyValue = (node: ObjectExpression): ObjectExpression => {
  let property = getParametersProperty(node);

  // NOTE: is a getter property - `get parameters()`
  // WARN: This is probably a bad idea. Need second opinion.
  // In the case when attribute _(prop)_ `parameters` was defined by the user in the `<Story />` component,
  // svelte internally will convert provided value into `Proxy`(?) _(I'm guessing on initial research)_.
  // This is some sort of reactivity-optimization(?).
  // The visualization below explains what's going to happen:
  //
  // Before:
  //
  // ```js
  // get parameters() {
  //   return something;
  // }
  //
  // ```js
  // parameters: {
  //   ...something,
  // },
  //
  if (
    property.kind === 'get' &&
    property.value.type === 'FunctionExpression' &&
    property.value.body.body[0].type === 'ReturnStatement'
  ) {
    const properties: ObjectExpression['properties'] = [];
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
    // TODO: Update message
    throw new Error('Invalid schema');
  }

  // FIXME: This is a dirty hack, because somehow the properties array gets preventExtension on,
  // and there's no possibility to push array, which leads to an error.
  if (!Object.isExtensible(property.value.properties)) {
    property.value.properties = Array.from(property.value.properties);
  }

  return property.value;
};

export const findPropertyDocsIndex = (node: ObjectExpression) => {
  return findASTPropertyIndex('docs', getParametersPropertyValue(node));
};

export const getDocsProperty = (node: ObjectExpression) => {
  return getParametersPropertyValue(node).properties[findPropertyDocsIndex(node)] as Property;
};

export const getDocsPropertyValue = (node: ObjectExpression) => {
  const { value } = getDocsProperty(node);

  if (value.type !== 'ObjectExpression') {
    throw new Error(
      // TODO: Add filename
      `Invalid schema for property "docs" value - expected "ObjectExpression", but got ${value.type}. Stories file: ${''}`
    );
  }

  return value;
};

export const findPropertyDescriptionIndex = (node: ObjectExpression) =>
  findASTPropertyIndex('description', getDocsPropertyValue(node));

export const getDescriptionProperty = (node: ObjectExpression) =>
  getDocsPropertyValue(node).properties[findPropertyDescriptionIndex(node)] as Property;

export const getDescriptionPropertyValue = (node: ObjectExpression) => {
  const { value } = getDescriptionProperty(node);

  if (value.type !== 'ObjectExpression') {
    throw new Error(
      // TODO: Add filename
      `Invalid schema for property "description" value - expected "ObjectExpression", but got ${value.type}. Stories file: ${''}`
    );
  }

  return value;
};
