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
