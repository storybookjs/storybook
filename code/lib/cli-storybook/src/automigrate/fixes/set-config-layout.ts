import { readFile, writeFile } from 'node:fs/promises';

import { findConfigFile, formatFileContent, HandledError } from 'storybook/internal/common';
import {
  babelParse,
  generate,
  traverse,
  types as t,
  unwrapTSExpression,
} from 'storybook/internal/babel';

import type { NodePath } from 'storybook/internal/babel';

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

const getStaticMemberName = (member: t.MemberExpression) => {
  if (t.isIdentifier(member.property) && !member.computed) {
    return member.property.name;
  }
  if (t.isStringLiteral(member.property)) {
    return member.property.value;
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

const isStaticValue = (node: t.Expression | t.PatternLike | t.SpreadElement): boolean => {
  if (!t.isExpression(node)) {
    return false;
  }
  const expression = unwrapTypeExpression(node);
  if (
    t.isBooleanLiteral(expression) ||
    t.isNumericLiteral(expression) ||
    t.isStringLiteral(expression) ||
    t.isNullLiteral(expression)
  ) {
    return true;
  }
  if (
    t.isUnaryExpression(expression, { operator: '-' }) &&
    t.isNumericLiteral(expression.argument)
  ) {
    return true;
  }
  if (t.isArrayExpression(expression)) {
    return expression.elements.every((element) => element === null || isStaticValue(element));
  }
  if (t.isObjectExpression(expression)) {
    return expression.properties.every(
      (property) =>
        t.isObjectProperty(property) &&
        getStaticPropertyName(property) !== null &&
        isStaticValue(property.value)
    );
  }
  return false;
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

  const dynamicProperty = movedProperties.find(
    (property) => !t.isObjectProperty(property) || !isStaticValue(property.value)
  );
  if (dynamicProperty) {
    throw migrationError(
      managerConfigPath,
      dynamicProperty,
      'moving the option could change expression evaluation order'
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
    const movedPropertyCopies = movedGroupProperties.map((property) =>
      t.cloneNode(property, true, true)
    );

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
      existingGroupValue.properties.unshift(...movedPropertyCopies);
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
        t.objectProperty(t.identifier(group), t.objectExpression(movedPropertyCopies))
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
  const ast = babelParse(source);
  const addonsImports = new Map<string, t.ImportSpecifier>();

  traverse(ast, {
    ImportDeclaration(path) {
      if (!managerApiPackages.has(path.node.source.value)) {
        return;
      }
      for (const specifier of path.node.specifiers) {
        if (
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: 'addons' })
        ) {
          addonsImports.set(specifier.local.name, specifier);
        }
      }
    },
  });

  let changed = false;
  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const { callee } = path.node;
      if (
        !t.isMemberExpression(callee) ||
        !t.isIdentifier(callee.object) ||
        getStaticMemberName(callee) !== 'setConfig'
      ) {
        return;
      }

      const importedSpecifier = addonsImports.get(callee.object.name);
      if (
        !importedSpecifier ||
        path.scope.getBinding(callee.object.name)?.path.node !== importedSpecifier
      ) {
        return;
      }

      const configArgument = path.node.arguments[0];
      if (!configArgument) {
        return;
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
    },
  });

  return changed ? generate(ast).code : source;
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
