/* eslint-disable no-underscore-dangle */
import { type ConfigFile, type CsfFile, loadConfig, loadCsf } from 'storybook/internal/csf-tools';

import * as t from '@babel/types';

function migrateA11yParameters(obj: t.ObjectExpression): boolean {
  const parametersProp = obj.properties.find(
    (prop) => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'parameters'
  );

  if (parametersProp && t.isObjectProperty(parametersProp)) {
    const parametersValue = parametersProp.value as t.ObjectExpression;
    const a11yProp = parametersValue.properties.find(
      (prop) => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'a11y'
    );

    if (a11yProp && t.isObjectProperty(a11yProp)) {
      const a11yValue = a11yProp.value as t.ObjectExpression;
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
  const parsed = loadCsf(code, { makeTitle: (title) => title }).parse();

  let hasChanges = false;

  if (t.isObjectExpression(parsed._metaNode)) {
    if (migrateA11yParameters(parsed._metaNode)) {
      hasChanges = true;
    }
  }

  Object.values(parsed._storyExports).forEach((declaration) => {
    const declarator = declaration as t.VariableDeclarator;
    let init = t.isVariableDeclarator(declarator) ? declarator.init : undefined;

    // For type annotations e.g. A<B> in `const Story = {} satisfies A<B>;`
    if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) {
      init = init.expression;
    }

    if (t.isObjectExpression(init)) {
      if (migrateA11yParameters(init)) {
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    return parsed;
  }

  return null;
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
