import { readFile, writeFile } from 'node:fs/promises';

import { findConfigFile, formatFileContent, HandledError } from 'storybook/internal/common';
import { types as t, unwrapTSExpression } from 'storybook/internal/babel';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import type { Fix } from '../types.ts';
import {
  findIndirectProperty,
  getDirectProperties,
  getDirectPropertyName,
  getObjectPropertyValue,
} from '../helpers/config-object.ts';

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
    optionGroups.has(getDirectPropertyName(property) ?? '')
  );
  if (movedProperties.length === 0 && !computedLegacyProperty) {
    return false;
  }

  const unknownProperty = findIndirectProperty(config);
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
      (property) => optionGroups.get(getDirectPropertyName(property) ?? '') === group
    );
    if (movedGroupProperties.length === 0) {
      continue;
    }
    const groupProperties = getDirectProperties(config, group);
    const existingGroup = groupProperties.at(-1);
    if (existingGroup) {
      const groupValue = getObjectPropertyValue(existingGroup);
      const existingGroupValue = groupValue ? unwrapTypeExpression(groupValue) : null;
      if (!t.isObjectExpression(existingGroupValue)) {
        throw migrationError(
          managerConfigPath,
          existingGroup,
          `the existing ${group} value is not an object literal`
        );
      }
      const movedNames = new Set(movedGroupProperties.map(getDirectPropertyName));
      existingGroupValue.properties = existingGroupValue.properties.filter(
        (property) => !movedNames.has(getDirectPropertyName(property))
      );
      existingGroupValue.properties.push(...movedGroupProperties);
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

  prompt: () => 'Move top-level setConfig layout and UI options into their nested objects',

  async run({ dryRun, result }) {
    if (!dryRun) {
      await writeFile(
        result.managerConfigPath,
        await formatFileContent(result.managerConfigPath, result.transformedSource)
      );
    }
  },
};
