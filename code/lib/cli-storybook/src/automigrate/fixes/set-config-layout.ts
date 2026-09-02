import { readFile, writeFile } from 'node:fs/promises';

import { findConfigFile, formatFileContent, HandledError } from 'storybook/internal/common';
import { types as t, unwrapTSExpression } from 'storybook/internal/babel';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import type { Fix } from '../types.ts';

const managerApiPackages = new Set(['storybook/manager-api', '@storybook/manager-api']);

const optionGroups = new Map<string, 'layout' | 'ui'>([
  ['initialActive', 'layout'],
  ['navSize', 'layout'],
  ['bottomPanelHeight', 'layout'],
  ['rightPanelWidth', 'layout'],
  ['recentVisibleSizes', 'layout'],
  ['panelPosition', 'layout'],
  ['showNav', 'layout'],
  ['showPanel', 'layout'],
  ['showTabs', 'layout'],
  ['showToolbar', 'layout'],
  ['showMobileNavigation', 'layout'],
  ['enableShortcuts', 'ui'],
]);

interface SetConfigLayoutOptions {
  managerConfigPath: string;
  transformedSource: string;
}

const getStaticPropertyName = (property: t.ObjectMember | t.SpreadElement) => {
  if (t.isSpreadElement(property) || property.computed) {
    return null;
  }
  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return null;
};

const unwrapTypeExpression = (node: t.Expression) => {
  let expression = unwrapTSExpression(node);
  while (t.isTSNonNullExpression(expression)) {
    expression = unwrapTSExpression(expression.expression);
  }
  return expression;
};

const migrationError = (managerConfigPath: string, node: t.Node, reason: string) => {
  const location = node.loc?.start.line ? ` on line ${node.loc.start.line}` : '';
  return new HandledError(
    `Cannot automigrate addons.setConfig in ${managerConfigPath}${location}: ${reason}. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually.`
  );
};

const migrateConfigObject = (config: t.ObjectExpression, managerConfigPath: string) => {
  const computedLegacyProperty = config.properties.find(
    (property) =>
      !t.isSpreadElement(property) &&
      property.computed &&
      t.isStringLiteral(property.key) &&
      optionGroups.has(property.key.value)
  );
  const movedProperties = config.properties.filter((property) =>
    optionGroups.has(getStaticPropertyName(property) ?? '')
  );
  if (movedProperties.length === 0 && !computedLegacyProperty) {
    return false;
  }

  const unknownProperty = config.properties.find(
    (property) => t.isSpreadElement(property) || getStaticPropertyName(property) === null
  );
  if (unknownProperty) {
    throw migrationError(
      managerConfigPath,
      unknownProperty,
      'the configuration contains a spread or computed property'
    );
  }

  let changed = false;

  for (const group of ['layout', 'ui'] as const) {
    const movedGroupProperties = config.properties.filter(
      (property) => optionGroups.get(getStaticPropertyName(property) ?? '') === group
    );
    if (movedGroupProperties.length === 0) {
      continue;
    }
    const groupProperties = config.properties.filter(
      (property) => getStaticPropertyName(property) === group
    );
    if (groupProperties.length > 1) {
      throw migrationError(
        managerConfigPath,
        groupProperties[1],
        `the configuration defines ${group} more than once`
      );
    }

    const existingGroup = groupProperties[0];
    if (existingGroup) {
      const existingGroupValue =
        t.isObjectProperty(existingGroup) && t.isExpression(existingGroup.value)
          ? unwrapTypeExpression(existingGroup.value)
          : null;
      if (!t.isObjectExpression(existingGroupValue)) {
        throw migrationError(
          managerConfigPath,
          existingGroup,
          `the existing ${group} value is not an object literal`
        );
      }
      const unknownNestedProperty = existingGroupValue.properties.find(
        (property) => t.isSpreadElement(property) || getStaticPropertyName(property) === null
      );
      if (unknownNestedProperty) {
        throw migrationError(
          managerConfigPath,
          unknownNestedProperty,
          `the existing ${group} object contains a spread or computed property`
        );
      }
      const existingNames = new Set(
        existingGroupValue.properties.map((property) => getStaticPropertyName(property))
      );
      const duplicateProperty = movedGroupProperties.find((property) =>
        existingNames.has(getStaticPropertyName(property))
      );
      if (duplicateProperty) {
        throw migrationError(
          managerConfigPath,
          duplicateProperty,
          `both the top-level configuration and ${group} define ${getStaticPropertyName(duplicateProperty)}`
        );
      }
      existingGroupValue.properties.unshift(...movedGroupProperties);
      config.properties = config.properties.filter(
        (property) => !movedGroupProperties.includes(property)
      );
    } else {
      const firstMovedIndex = config.properties.findIndex((property) =>
        movedGroupProperties.includes(property)
      );
      const insertionIndex = config.properties
        .slice(0, firstMovedIndex)
        .filter((property) => !movedGroupProperties.includes(property)).length;
      config.properties = config.properties.filter(
        (property) => !movedGroupProperties.includes(property)
      );
      config.properties.splice(
        insertionIndex,
        0,
        t.objectProperty(t.identifier(group), t.objectExpression(movedGroupProperties))
      );
    }
    changed = true;
  }

  return changed;
};

export const transformSetConfigLayout = (
  source: string,
  managerConfigPath = '.storybook/manager.*'
) => {
  const managerConfig = loadConfig(source).parse();
  let changed = false;
  const calls = managerConfig.findNamedImportMethodCalls({
    importedName: 'addons',
    methodName: 'setConfig',
    moduleNames: managerApiPackages,
  });
  for (const call of calls) {
    const configArgument = call.arguments[0];
    if (!configArgument) {
      continue;
    }
    if (!t.isExpression(configArgument)) {
      throw migrationError(
        managerConfigPath,
        configArgument,
        'the configuration argument is not an object literal'
      );
    }
    const config = unwrapTypeExpression(configArgument);
    if (!t.isObjectExpression(config)) {
      throw migrationError(
        managerConfigPath,
        config,
        'the configuration argument is not an object literal'
      );
    }
    if (migrateConfigObject(config, managerConfigPath)) {
      changed = true;
    }
  }

  return changed ? formatConfig(managerConfig) : source;
};

export const setConfigLayout: Fix<SetConfigLayoutOptions> = {
  id: 'set-config-layout',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#top-level-setconfig-layout-and-ui-options-removed',

  async check({ configDir }) {
    if (!configDir) {
      return null;
    }
    const managerConfigPath = findConfigFile('manager', configDir);
    if (!managerConfigPath) {
      return null;
    }

    const source = await readFile(managerConfigPath, 'utf8');
    const transformedSource = transformSetConfigLayout(source, managerConfigPath);
    return transformedSource === source ? null : { managerConfigPath, transformedSource };
  },

  prompt: () => 'Move top-level setConfig layout and UI options into their nested objects?',

  async run({ dryRun, result }) {
    if (!dryRun) {
      await writeFile(
        result.managerConfigPath,
        await formatFileContent(result.managerConfigPath, result.transformedSource)
      );
    }
  },
};
