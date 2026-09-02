import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types.ts';

interface StorySortToMainOptions {
  mainConfig: ConfigFile;
  mainConfigPath: string;
  previewConfig: ConfigFile;
  previewConfigPath: string;
  storySort: t.ArrayExpression | t.ObjectExpression;
}

const isStaticLiteral = (node: t.Node | null | undefined): boolean => {
  if (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node)
  ) {
    return true;
  }
  if (t.isArrayExpression(node)) {
    return node.elements.every((element) => element !== null && isStaticLiteral(element));
  }
  if (t.isObjectExpression(node)) {
    return node.properties.every(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        !property.shorthand &&
        isStaticLiteral(property.value)
    );
  }
  return false;
};

const unwrapTypeScriptExpression = (node: t.Expression): t.Expression => {
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)) {
    return unwrapTypeScriptExpression(node.expression);
  }
  return node;
};

const propertyKey = (property: t.ObjectProperty): string | undefined => {
  if (t.isIdentifier(property.key) && !property.computed) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key) && !property.computed) {
    return property.key.value;
  }
  return undefined;
};

const countProperties = (config: ConfigFile, path: string[], name: string) => {
  const properties = config.getFieldProperties(path);
  return properties?.filter((property) => propertyKey(property) === name).length ?? 0;
};

const findVariableInitialization = (config: ConfigFile, name: string) => {
  for (const statement of config._ast.program.body) {
    const declaration = t.isVariableDeclaration(statement)
      ? statement
      : t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)
        ? statement.declaration
        : undefined;
    const declarator = declaration?.declarations.find(
      (candidate) => t.isIdentifier(candidate.id) && candidate.id.name === name
    );
    if (declarator?.init && t.isExpression(declarator.init)) {
      return declarator.init;
    }
  }
  return undefined;
};

const findPathValues = (
  config: ConfigFile,
  node: t.Expression,
  path: string[],
  seen = new Set<string>()
): t.Expression[] => {
  const expression = unwrapTypeScriptExpression(node);
  if (t.isIdentifier(expression)) {
    if (seen.has(expression.name)) {
      return [];
    }
    const initialization = findVariableInitialization(config, expression.name);
    return initialization
      ? findPathValues(config, initialization, path, new Set(seen).add(expression.name))
      : [];
  }
  if (path.length === 0) {
    return [expression];
  }
  if (!t.isObjectExpression(expression)) {
    return [];
  }

  const [field, ...rest] = path;
  return expression.properties.flatMap((property) => {
    if (t.isSpreadElement(property) && t.isExpression(property.argument)) {
      return findPathValues(config, property.argument, path, seen);
    }
    if (
      t.isObjectProperty(property) &&
      propertyKey(property) === field &&
      t.isExpression(property.value)
    ) {
      return findPathValues(config, property.value, rest, seen);
    }
    return [];
  });
};

const findLegacyStorySort = (config: ConfigFile) =>
  config._ast.program.body.flatMap((statement) => {
    if (t.isExportDefaultDeclaration(statement) && t.isExpression(statement.declaration)) {
      return findPathValues(config, statement.declaration, ['parameters', 'options', 'storySort']);
    }
    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      return statement.declaration.declarations.flatMap((declarator) =>
        t.isIdentifier(declarator.id) &&
        declarator.id.name === 'parameters' &&
        declarator.init &&
        t.isExpression(declarator.init)
          ? findPathValues(config, declarator.init, ['options', 'storySort'])
          : []
      );
    }
    return [];
  });

const rootContainsSpread = (config: ConfigFile) =>
  config._exportsObject?.properties.some((property) => t.isSpreadElement(property)) ?? false;

const removeRootField = (config: ConfigFile, name: string) => {
  if (config._exportsObject) {
    config._exportsObject.properties = config._exportsObject.properties.filter(
      (property) => !t.isObjectProperty(property) || propertyKey(property) !== name
    );
  }

  config._ast.program.body = config._ast.program.body.flatMap((statement) => {
    if (!t.isExportNamedDeclaration(statement) || !t.isVariableDeclaration(statement.declaration)) {
      return statement;
    }

    statement.declaration.declarations = statement.declaration.declarations.filter(
      (declarator) => !t.isIdentifier(declarator.id) || declarator.id.name !== name
    );
    return statement.declaration.declarations.length > 0 ? statement : [];
  });
};

const removeEmptyParent = (config: ConfigFile, path: string[]) => {
  const node = config.getFieldNode(path);
  if (t.isObjectExpression(node) && node.properties.length === 0) {
    if (path.length === 1) {
      removeRootField(config, path[0]);
    } else {
      config.removeField(path);
    }
  }
};

export const storySortToMain: Fix<StorySortToMainOptions> = {
  id: 'story-sort-to-main',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysort-moved-to-main',

  async check({ mainConfigPath, previewConfigPath }) {
    if (!mainConfigPath || !previewConfigPath) {
      return null;
    }

    const [mainSource, previewSource] = await Promise.all([
      readFile(mainConfigPath, 'utf8'),
      readFile(previewConfigPath, 'utf8'),
    ]);
    const mainConfig = loadConfig(mainSource).parse();
    const previewConfig = loadConfig(previewSource).parse();
    const storySortNode = previewConfig.getFieldNode([
      'parameters',
      'options',
      'storySort',
    ]) as t.Expression;

    if (!storySortNode) {
      if (findLegacyStorySort(previewConfig).length > 0) {
        throw new Error(dedent`
          Storybook cannot safely locate parameters.options.storySort in ${previewConfigPath} because the preview configuration uses an identifier or spread. Move it manually to top-level storySort in ${mainConfigPath}, then remove it from preview.
        `);
      }
      return null;
    }
    if (countProperties(previewConfig, ['parameters', 'options', 'storySort'], 'storySort') > 1) {
      throw new Error(dedent`
        ${previewConfigPath} defines storySort more than once. Reconcile the values manually, keep the final value as top-level storySort in ${mainConfigPath}, and remove all preview storySort properties.
      `);
    }
    if (rootContainsSpread(mainConfig)) {
      throw new Error(dedent`
        Storybook cannot safely add storySort because the root of ${mainConfigPath} main config contains a spread. Add top-level storySort manually and remove parameters.options.storySort from ${previewConfigPath}.
      `);
    }
    if (mainConfig.getFieldNode(['storySort'])) {
      throw new Error(dedent`
        Both main and preview define storySort. Reconcile the values manually, keep the final value as top-level storySort in ${mainConfigPath}, and remove parameters.options.storySort from ${previewConfigPath}.
      `);
    }
    const storySort = unwrapTypeScriptExpression(storySortNode);
    if (
      (!t.isArrayExpression(storySort) && !t.isObjectExpression(storySort)) ||
      !isStaticLiteral(storySort)
    ) {
      throw new Error(dedent`
        Storybook cannot safely move parameters.options.storySort from ${previewConfigPath} because it contains a function or dynamic expression. Move it manually to top-level storySort in ${mainConfigPath}, including any variables it depends on, then remove it from preview.
      `);
    }

    return {
      mainConfig,
      mainConfigPath,
      previewConfig,
      previewConfigPath,
      storySort: t.cloneNode(storySort, true),
    };
  },

  prompt: () =>
    `Move ${picocolors.cyan('parameters.options.storySort')} from preview to ${picocolors.cyan('storySort')} in main?`,

  async run({ dryRun, result }) {
    result.mainConfig.setFieldNode(['storySort'], result.storySort);
    result.previewConfig.removeField(['parameters', 'options', 'storySort']);
    removeEmptyParent(result.previewConfig, ['parameters', 'options']);
    removeEmptyParent(result.previewConfig, ['parameters']);

    if (!dryRun) {
      await writeFile(result.mainConfigPath, formatConfig(result.mainConfig));
      await writeFile(result.previewConfigPath, formatConfig(result.previewConfig));
    }
  },
};
