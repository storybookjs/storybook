import { types as t } from 'storybook/internal/babel';

import type { Expression, ObjectExpression } from '@babel/types';

/** Get a property from an object expression by name */
export function getObjectProperty(
  obj: ObjectExpression,
  propertyName: string
): Expression | undefined {
  if (!obj || !obj.properties) {
    return undefined;
  }

  const property = obj.properties.find(
    (prop) =>
      t.isObjectProperty(prop) &&
      ((t.isIdentifier(prop.key) && prop.key.name === propertyName) ||
        (t.isStringLiteral(prop.key) && prop.key.value === propertyName))
  ) as t.ObjectProperty;

  return property?.value as Expression;
}

/** Remove a property from an object expression by name */
export function removeProperty(obj: ObjectExpression, propertyName: string): void {
  if (!obj || !obj.properties) {
    return;
  }

  const index = obj.properties.findIndex(
    (prop) =>
      t.isObjectProperty(prop) &&
      ((t.isIdentifier(prop.key) && prop.key.name === propertyName) ||
        (t.isStringLiteral(prop.key) && prop.key.value === propertyName))
  );

  if (index !== -1) {
    obj.properties.splice(index, 1);
  }
}

/** Add a property to an object expression */
export function addProperty(obj: ObjectExpression, propertyName: string, value: Expression): void {
  if (!obj || !obj.properties) {
    return;
  }

  obj.properties.push(t.objectProperty(t.identifier(propertyName), value));
}

/** Transform values array to options object for background keys */
export function transformValuesToOptions(valuesArray: t.ArrayExpression): t.Expression {
  // Transform [{ name: 'Light', value: '#FFF' }] to { light: { name: 'Light', value: '#FFF' } }
  const optionsObject = t.objectExpression([]);

  if (valuesArray && t.isArrayExpression(valuesArray) && valuesArray.elements) {
    valuesArray.elements.forEach((element) => {
      if (t.isObjectExpression(element)) {
        const nameProperty = getObjectProperty(element, 'name');

        if (t.isStringLiteral(nameProperty)) {
          const key = nameProperty.value.toLowerCase().replace(/\s+/g, '_');

          // For complex names with dots, brackets, or other special characters, use string literal
          // For simple names, use identifier
          const keyNode = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
            ? t.identifier(key)
            : t.stringLiteral(nameProperty.value);

          optionsObject.properties.push(t.objectProperty(keyNode, element));
        }
      }
    });
  }

  return optionsObject;
}

/** Get key from name using the options mapping */
export function getKeyFromName(valuesArray: t.Expression | undefined, name: string): string {
  // Generate a key from a name in the values array
  if (valuesArray && t.isArrayExpression(valuesArray) && valuesArray.elements) {
    for (const element of valuesArray.elements) {
      if (t.isObjectExpression(element)) {
        const nameProperty = getObjectProperty(element, 'name');

        if (t.isStringLiteral(nameProperty) && nameProperty.value === name) {
          return name.toLowerCase().replace(/\s+/g, '_');
        }
      }
    }
  }

  // If not found, generate a key from the name
  return name.toLowerCase().replace(/\s+/g, '_');
}
