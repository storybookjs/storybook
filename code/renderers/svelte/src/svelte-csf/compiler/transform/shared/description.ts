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
export function createASTObjectExpression(properties: Property[] = []): ObjectExpression {
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

export const getParametersPropertyValue = (node: ObjectExpression) => {
  const { value } = getParametersProperty(node);

  if (value.type !== 'ObjectExpression') {
    // TODO: Improve error message
    throw new Error('Invalid schema');
  }

  return value;
};

export const findPropertyDocsIndex = (node: ObjectExpression) =>
  findASTPropertyIndex('docs', getParametersPropertyValue(node));

export const getDocsProperty = (node: ObjectExpression) =>
  getParametersPropertyValue(node).properties[findPropertyDocsIndex(node)] as Property;

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
