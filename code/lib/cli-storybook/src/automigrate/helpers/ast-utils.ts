import { types as t } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';

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

/** Get the story object from a declaration (handles both story exports and meta exports) */
export function getStoryObject(declaration: t.Node): t.ObjectExpression | undefined {
  if (t.isVariableDeclarator(declaration)) {
    // Handle story exports: `export const Story = { ... }`
    let init = declaration.init;
    if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) {
      init = init.expression;
    }
    if (t.isObjectExpression(init)) {
      return init;
    }
  } else if (t.isExportDefaultDeclaration(declaration)) {
    // Handle meta export: `export default { ... }`
    let init = declaration.declaration;
    if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) {
      init = init.expression;
    }
    if (t.isObjectExpression(init)) {
      return init;
    }
  }

  return undefined;
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
export function getKeyFromName(valuesArray: t.ArrayExpression, name: string): string {
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

/** Options for story transformation */
export interface StoryTransformOptions {
  /** Whether to transform the meta export (export default) */
  includeMeta?: boolean;
  /** Whether to transform story exports */
  includeStories?: boolean;
}

/** Callback function for transforming a story object */
export type StoryTransformCallback = (
  storyObject: t.ObjectExpression,
  storyName: string,
  csf: CsfFile
) => boolean;

/** Callback function for transforming story parameters */
export type StoryParametersTransformCallback = (
  parameters: t.ObjectExpression,
  storyObject: t.ObjectExpression,
  storyName: string,
  csf: CsfFile
) => boolean;

/** Callback function for transforming story globals */
export type StoryGlobalsTransformCallback = (
  globals: t.ObjectExpression,
  storyObject: t.ObjectExpression,
  storyName: string,
  csf: CsfFile
) => boolean;

/** Transform all stories in a CSF file using a callback function */
export function transformStories(
  csf: CsfFile,
  transformCallback: StoryTransformCallback,
  options: StoryTransformOptions = { includeMeta: true, includeStories: true }
): boolean {
  let hasChanges = false;

  // Transform story exports
  if (options.includeStories) {
    Object.entries(csf._storyExports).forEach(([storyName, declaration]) => {
      const storyObject = getStoryObject(declaration);
      if (storyObject) {
        if (transformCallback(storyObject, storyName, csf)) {
          hasChanges = true;
        }
      }
    });
  }

  // Transform meta export
  if (options.includeMeta && csf._metaPath) {
    const storyObject = getStoryObject(csf._metaPath.node);
    if (storyObject) {
      if (transformCallback(storyObject, 'meta', csf)) {
        hasChanges = true;
      }
    }
  }

  return hasChanges;
}

/** Transform stories with parameters-specific logic */
export function transformStoryParameters(
  csf: CsfFile,
  transformParameters: StoryParametersTransformCallback,
  options: StoryTransformOptions = { includeMeta: true, includeStories: true }
): boolean {
  return transformStories(
    csf,
    (storyObject, storyName, csf) => {
      const parameters = getObjectProperty(storyObject, 'parameters') as t.ObjectExpression;
      if (parameters) {
        return transformParameters(parameters, storyObject, storyName, csf);
      }
      return false;
    },
    options
  );
}
