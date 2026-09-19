import { readFile, writeFile } from 'node:fs/promises';

import { findConfigFile, formatFileContent, HandledError } from 'storybook/internal/common';
import { types as t, unwrapTSExpression } from 'storybook/internal/babel';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import type { Fix } from '../types.ts';
import {
  findIndirectProperty,
  getStaticProperties,
  getStaticPropertyName,
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
    `Cannot automigrate addons.setConfig in ${managerConfigPath}${location}: ${reason}. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually. Keep nested values when an option exists in both places and retain expression evaluation order.`
  );
};

const getComputedPropertyName = (property: t.ObjectMember | t.SpreadElement) => {
  if (t.isSpreadElement(property) || !property.computed) {
    return undefined;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  if (t.isTemplateLiteral(property.key) && property.key.expressions.length === 0) {
    return property.key.quasis[0]?.value.cooked;
  }
  return undefined;
};

const getPropertyValue = (property: t.ObjectMember | t.SpreadElement) => {
  if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
    return undefined;
  }
  return unwrapTypeExpression(property.value);
};

const isEvaluationInert = (node: t.Expression): boolean => {
  if (t.isLiteral(node) || t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    return true;
  }
  if (t.isUnaryExpression(node)) {
    return isEvaluationInert(node.argument);
  }
  if (t.isArrayExpression(node)) {
    return node.elements.every(
      (element) => element === null || (t.isExpression(element) && isEvaluationInert(element))
    );
  }
  if (t.isObjectExpression(node)) {
    return node.properties.every((property) => {
      const value = getPropertyValue(property);
      return (
        getStaticPropertyName(property) !== undefined &&
        value !== undefined &&
        isEvaluationInert(value)
      );
    });
  }
  return false;
};

const describeUnsafeMember = (property: t.ObjectMember | t.SpreadElement) => {
  if (t.isSpreadElement(property)) {
    return 'a spread property';
  }
  if (property.computed) {
    return 'a computed property';
  }
  return 'an unreadable property';
};

const assertMovableProperties = (
  properties: t.ObjectMember[],
  managerConfigPath: string,
  group: 'layout' | 'ui'
) => {
  const unsafeProperty = properties.find((property) => !getPropertyValue(property));
  if (unsafeProperty) {
    const name = getStaticPropertyName(unsafeProperty);
    throw migrationError(
      managerConfigPath,
      unsafeProperty,
      `the top-level ${name} ${group} option is a method or accessor, not a movable value property`
    );
  }
};

const migrateIntoExistingGroup = (
  config: t.ObjectExpression,
  existingGroup: t.ObjectMember,
  movedProperties: t.ObjectMember[],
  group: 'layout' | 'ui',
  managerConfigPath: string
) => {
  const groupValue = getPropertyValue(existingGroup);
  if (!t.isObjectExpression(groupValue)) {
    throw migrationError(
      managerConfigPath,
      existingGroup,
      `the existing ${group} value is not an object literal`
    );
  }

  const indirectProperty = findIndirectProperty(groupValue);
  if (indirectProperty) {
    throw migrationError(
      managerConfigPath,
      indirectProperty,
      `the existing ${group} object contains ${describeUnsafeMember(indirectProperty)}`
    );
  }
  const nonValueProperty = groupValue.properties.find((property) => !getPropertyValue(property));
  if (nonValueProperty) {
    throw migrationError(
      managerConfigPath,
      nonValueProperty,
      `the existing ${group} object contains a method or accessor`
    );
  }

  const nestedNames = new Set(groupValue.properties.map(getStaticPropertyName));
  const conflictingProperty = movedProperties.find((property) =>
    nestedNames.has(getStaticPropertyName(property))
  );
  if (conflictingProperty) {
    const name = getStaticPropertyName(conflictingProperty);
    throw migrationError(
      managerConfigPath,
      conflictingProperty,
      `the ${name} option exists at both top level and inside ${group}, where the nested value is authoritative`
    );
  }

  const effectfulProperty = movedProperties.find((property) => {
    const value = getPropertyValue(property);
    return !value || !isEvaluationInert(value);
  });
  if (effectfulProperty) {
    const name = getStaticPropertyName(effectfulProperty);
    const value = getPropertyValue(effectfulProperty);
    throw migrationError(
      managerConfigPath,
      effectfulProperty,
      `the ${name} option has a ${value?.type ?? 'non-expression'} value whose relocation into the existing ${group} object could change expression evaluation order`
    );
  }

  groupValue.properties.unshift(...movedProperties);
  const movedPropertySet: Set<t.ObjectMember | t.SpreadElement> = new Set(movedProperties);
  config.properties = config.properties.filter((property) => !movedPropertySet.has(property));
};

const wrapContiguousProperties = (
  config: t.ObjectExpression,
  movedProperties: t.ObjectMember[],
  group: 'layout' | 'ui',
  managerConfigPath: string
) => {
  const firstMovedIndex = config.properties.indexOf(movedProperties[0]);
  const lastMovedIndex = config.properties.indexOf(movedProperties.at(-1)!);
  if (lastMovedIndex - firstMovedIndex + 1 !== movedProperties.length) {
    throw migrationError(
      managerConfigPath,
      movedProperties[1] ?? movedProperties[0],
      `the top-level ${group} options are not contiguous, so grouping them could change expression evaluation order`
    );
  }
  config.properties.splice(
    firstMovedIndex,
    movedProperties.length,
    t.objectProperty(t.identifier(group), t.objectExpression(movedProperties))
  );
};

const migrateGroup = (
  config: t.ObjectExpression,
  group: 'layout' | 'ui',
  managerConfigPath: string
) => {
  const movedProperties = config.properties.filter(
    (property): property is t.ObjectMember =>
      !t.isSpreadElement(property) &&
      optionGroups.get(getStaticPropertyName(property) ?? '') === group
  );
  if (movedProperties.length === 0) {
    return false;
  }
  assertMovableProperties(movedProperties, managerConfigPath, group);

  const groupProperties = getStaticProperties(config, group);
  if (groupProperties.length > 1) {
    throw migrationError(
      managerConfigPath,
      groupProperties[1],
      `the configuration defines ${group} more than once`
    );
  }
  if (groupProperties[0]) {
    migrateIntoExistingGroup(config, groupProperties[0], movedProperties, group, managerConfigPath);
  } else {
    wrapContiguousProperties(config, movedProperties, group, managerConfigPath);
  }
  return true;
};

const migrateConfigObject = (config: t.ObjectExpression, managerConfigPath: string) => {
  const hasDirectLegacyProperty = config.properties.some((property) =>
    optionGroups.has(getStaticPropertyName(property) ?? '')
  );
  const computedLegacyProperty = config.properties.find((property) =>
    optionGroups.has(getComputedPropertyName(property) ?? '')
  );
  if (!hasDirectLegacyProperty && !computedLegacyProperty) {
    return false;
  }

  const indirectProperty = findIndirectProperty(config);
  if (indirectProperty) {
    throw migrationError(
      managerConfigPath,
      indirectProperty,
      `the configuration contains ${describeUnsafeMember(indirectProperty)}`
    );
  }

  let changed = false;
  for (const group of ['layout', 'ui'] as const) {
    if (migrateGroup(config, group, managerConfigPath)) {
      changed = true;
    }
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
