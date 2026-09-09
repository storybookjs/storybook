import { type ConfigFile, type CsfFile, loadConfig, loadCsf } from 'storybook/internal/csf-tools';

import { types as t } from 'storybook/internal/babel';

import { getObjectProperty } from './ast-utils.ts';

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

  for (const object of parsed.objects({ annotations: ['parameters'] })) {
    object.rename(['parameters', 'a11y', 'element'], 'context');
  }

  return parsed.changed ? parsed : null;
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
