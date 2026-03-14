import { types as t } from 'storybook/internal/babel';
import { type ConfigFile, type CsfFile, loadConfig, loadCsf } from 'storybook/internal/csf-tools';

import { getObjectProperty, transformStories } from './ast-utils';

// TODO: this is copied from the codemod, we should move both utilities to the csf-tools package at some point
const isStoryAnnotation = (stmt: t.Statement, objectExports: Record<string, any>) =>
  t.isExpressionStatement(stmt) &&
  t.isAssignmentExpression(stmt.expression) &&
  t.isMemberExpression(stmt.expression.left) &&
  t.isIdentifier(stmt.expression.left.object) &&
  objectExports[stmt.expression.left.object.name];

function migrateA11yParameters(obj: t.ObjectExpression): boolean {
  const parametersValue = getObjectProperty(obj, 'parameters') as t.ObjectExpression | undefined;

  if (parametersValue) {
    const a11yValue = getObjectProperty(parametersValue, 'a11y') as t.ObjectExpression | undefined;

    if (a11yValue) {
      const elementProp = a11yValue.properties.find(
        (prop) =>
          t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'element'
      );
      if (elementProp && t.isObjectProperty(elementProp)) {
        elementProp.key = t.identifier('context');
        return true;
      }
    }
  }

  return false;
}

export function transformStoryA11yParameters(code: string): CsfFile | null {
  const parsed = loadCsf(code, { makeTitle: (title?: string) => title || 'default' }).parse();

  // Use the story transformer utility to handle all story iteration
  let hasChanges = transformStories(parsed, (storyObject, storyName, csf) => {
    return migrateA11yParameters(storyObject);
  });

  // Also handle CSF2-style story annotations
  parsed._ast.program.body.forEach((stmt: t.Statement) => {
    const statement = stmt;
    if (
      isStoryAnnotation(statement, parsed._storyExports) &&
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      t.isObjectExpression(statement.expression.right)
    ) {
      const parameters = statement.expression.right.properties;
      parameters.forEach((param) => {
        if (t.isObjectProperty(param) && t.isIdentifier(param.key) && param.key.name === 'a11y') {
          const a11yValue = param.value as t.ObjectExpression;
          const elementProp = a11yValue.properties.find(
            (prop) =>
              t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'element'
          );
          if (elementProp && t.isObjectProperty(elementProp)) {
            elementProp.key = t.identifier('context');
            hasChanges = true;
          }
        }
      });
    }
  });

  return hasChanges ? parsed : null;
}

export function transformPreviewA11yParameters(code: string): ConfigFile | null {
  const parsed = loadConfig(code).parse();

  if (parsed._exportsObject && t.isObjectExpression(parsed._exportsObject)) {
    if (migrateA11yParameters(parsed._exportsObject)) {
      return parsed;
    }
  }

  return null;
}
