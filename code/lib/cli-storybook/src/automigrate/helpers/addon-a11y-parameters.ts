import { type ConfigFile, type CsfFile, loadConfig, loadCsf } from 'storybook/internal/csf-tools';

import { types as t } from 'storybook/internal/babel';

export function transformStoryA11yParameters(code: string): CsfFile | null {
  const parsed = loadCsf(code, { makeTitle: (title?: string) => title || 'default' }).parse();

  for (const object of parsed.objects({ annotations: ['parameters'] })) {
    object.rename(['parameters', 'a11y', 'element'], 'context');
  }

  return parsed.changed ? parsed : null;
}

export function transformPreviewA11yParameters(code: string): ConfigFile | null {
  const parsed = loadConfig(code).parse();
  const a11y = parsed.getFieldNode(['parameters', 'a11y']);
  if (!t.isObjectExpression(a11y)) {
    return null;
  }

  const element = a11y.properties.find(
    (property) => t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'element' })
  );
  if (!t.isObjectProperty(element)) {
    return null;
  }

  element.key = t.identifier('context');
  return parsed;
}
