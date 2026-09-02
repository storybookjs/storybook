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

const findConfigFactoryArgument = (node: t.Expression): t.Expression | undefined => {
  const expression = unwrapTypeScriptExpression(node);
  if (!t.isCallExpression(expression)) {
    return undefined;
  }
  if (t.isExpression(expression.arguments[0])) {
    return expression.arguments[0];
  }
  if (t.isMemberExpression(expression.callee) && t.isCallExpression(expression.callee.object)) {
    return findConfigFactoryArgument(expression.callee.object);
  }
  return undefined;
};

const findPathValues = (
  config: ConfigFile,
  node: t.Expression,
  path: string[],
  seen = new Set<string>(),
  followCalls = false
): t.Node[] => {
  const expression = unwrapTypeScriptExpression(node);
  const configFactoryArgument = followCalls ? findConfigFactoryArgument(expression) : undefined;
  if (configFactoryArgument) {
    return findPathValues(config, configFactoryArgument, path, seen, followCalls);
  }
  if (t.isIdentifier(expression)) {
    if (seen.has(expression.name)) {
      return [];
    }
    const initialization = findVariableInitialization(config, expression.name);
    return initialization
      ? findPathValues(
          config,
          initialization,
          path,
          new Set(seen).add(expression.name),
          followCalls
        )
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
      return findPathValues(config, property.argument, path, seen, followCalls);
    }
    if (t.isObjectProperty(property) && t.isExpression(property.value)) {
      const key = staticPropertyKey(property);
      if (key === field) {
        return findPathValues(config, property.value, rest, seen, followCalls);
      }
      if (property.computed && key === undefined) {
        return rest.length === 0
          ? [property]
          : findPathValues(config, property.value, rest, seen, followCalls);
      }
    }
    if (
      t.isObjectMethod(property) &&
      (staticPropertyKey(property) === field ||
        (property.computed && staticPropertyKey(property) === undefined))
    ) {
      return [property];
    }
    return [];
  });
};

const isModuleExports = (node: t.Node): node is t.MemberExpression =>
  t.isMemberExpression(node) &&
  t.isIdentifier(node.object) &&
  node.object.name === 'module' &&
  ((!node.computed && t.isIdentifier(node.property) && node.property.name === 'exports') ||
    (node.computed && t.isStringLiteral(node.property) && node.property.value === 'exports'));

const isWritableModuleExports = (node: t.Node): node is t.MemberExpression =>
  t.isMemberExpression(node) &&
  !node.computed &&
  t.isIdentifier(node.object) &&
  node.object.name === 'module' &&
  t.isIdentifier(node.property) &&
  node.property.name === 'exports';

const isCommonJsExportReference = (node: t.Node): boolean => {
  if (t.isIdentifier(node)) {
    return node.name === 'exports';
  }
  if (!t.isMemberExpression(node)) {
    return false;
  }
  const object = node.object;
  return isModuleExports(node) || isCommonJsExportReference(object);
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
    if (t.isExportNamedDeclaration(statement)) {
      return statement.specifiers.flatMap((specifier) => {
        if (
          !t.isExportSpecifier(specifier) ||
          !t.isIdentifier(specifier.local) ||
          !t.isIdentifier(specifier.exported) ||
          specifier.exported.name !== 'parameters'
        ) {
          return [];
        }
        const initialization = findVariableInitialization(config, specifier.local.name);
        return initialization
          ? findPathValues(config, initialization, ['options', 'storySort'])
          : [];
      });
    }
    if (
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      isModuleExports(statement.expression.left) &&
      t.isExpression(statement.expression.right)
    ) {
      return findPathValues(config, statement.expression.right, [
        'parameters',
        'options',
        'storySort',
      ]);
    }
    return [];
  });

const findCallWrappedLegacyStorySort = (config: ConfigFile) =>
  config._ast.program.body.flatMap((statement) => {
    if (
      !t.isExportDefaultDeclaration(statement) ||
      !t.isExpression(statement.declaration) ||
      !t.isCallExpression(unwrapTypeScriptExpression(statement.declaration))
    ) {
      return [];
    }
    return findPathValues(
      config,
      statement.declaration,
      ['parameters', 'options', 'storySort'],
      new Set<string>(),
      true
    );
  });

const rootContainsSpread = (config: ConfigFile) =>
  config._exportsObject?.properties.some((property) => t.isSpreadElement(property)) ?? false;

const staticPropertyKey = (property: t.ObjectMethod | t.ObjectProperty): string | undefined => {
  if (t.isIdentifier(property.key) && !property.computed) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

const countObjectProperties = (node: t.Node | null | undefined, name: string) =>
  t.isObjectExpression(node)
    ? node.properties.filter(
        (property) =>
          (t.isObjectProperty(property) || t.isObjectMethod(property)) &&
          staticPropertyKey(property) === name
      ).length
    : 0;

const previewParametersRootCount = (config: ConfigFile) =>
  config._ast.program.body.reduce((count, statement) => {
    if (t.isExportDefaultDeclaration(statement) && t.isExpression(statement.declaration)) {
      const root = unwrapTypeScriptExpression(statement.declaration);
      return count + countObjectProperties(root, 'parameters');
    }
    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      return (
        count +
        statement.declaration.declarations.filter(
          (declarator) => t.isIdentifier(declarator.id) && declarator.id.name === 'parameters'
        ).length
      );
    }
    if (t.isExportNamedDeclaration(statement)) {
      return (
        count +
        statement.specifiers.filter(
          (specifier) =>
            t.isExportSpecifier(specifier) &&
            t.isIdentifier(specifier.exported) &&
            specifier.exported.name === 'parameters'
        ).length
      );
    }
    if (
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      isModuleExports(statement.expression.left) &&
      t.isExpression(statement.expression.right)
    ) {
      return count + countObjectProperties(statement.expression.right, 'parameters');
    }
    return count;
  }, 0);

const resolvesToCall = (
  config: ConfigFile,
  node: t.Expression,
  seen = new Set<string>()
): boolean => {
  const expression = unwrapTypeScriptExpression(node);
  if (t.isCallExpression(expression)) {
    return true;
  }
  if (!t.isIdentifier(expression) || seen.has(expression.name)) {
    return false;
  }
  const initialization = findVariableInitialization(config, expression.name);
  return initialization
    ? resolvesToCall(config, initialization, new Set(seen).add(expression.name))
    : false;
};

const mainDefaultExportUsesCall = (config: ConfigFile) =>
  config._ast.program.body.some(
    (statement) =>
      t.isExportDefaultDeclaration(statement) &&
      t.isExpression(statement.declaration) &&
      resolvesToCall(config, statement.declaration)
  );

const mainHasUnsupportedExportShape = (config: ConfigFile) => {
  if (config.hasDefaultExport && (!config._exportsObject || mainDefaultExportUsesCall(config))) {
    return true;
  }
  return config._ast.program.body.some(
    (statement) =>
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      isCommonJsExportReference(statement.expression.left) &&
      (!isWritableModuleExports(statement.expression.left) ||
        !config._exportsObject ||
        (t.isExpression(statement.expression.right) &&
          resolvesToCall(config, statement.expression.right)))
  );
};

const mainDefinesStorySort = (config: ConfigFile) =>
  countObjectProperties(config._exportsObject, 'storySort') > 0 ||
  Object.hasOwn(config._exports, 'storySort') ||
  Object.hasOwn(config._exportDecls, 'storySort');

const pathUsesIndirectValue = (node: t.Expression, path: string[]): boolean => {
  const expression = unwrapTypeScriptExpression(node);
  if (t.isIdentifier(expression)) {
    return true;
  }
  if (!t.isObjectExpression(expression)) {
    return true;
  }

  const [field, ...rest] = path;
  const values = expression.properties.flatMap((property) =>
    t.isObjectProperty(property) &&
    propertyKey(property) === field &&
    t.isExpression(property.value)
      ? [property.value]
      : []
  );
  return rest.length > 0 && values.some((value) => pathUsesIndirectValue(value, rest));
};

const previewStorySortPathUsesIndirectValue = (config: ConfigFile) =>
  config._ast.program.body.some((statement) => {
    if (t.isExportDefaultDeclaration(statement) && t.isExpression(statement.declaration)) {
      return (
        findPathValues(config, statement.declaration, ['parameters', 'options', 'storySort'])
          .length > 0 && pathUsesIndirectValue(statement.declaration, ['parameters', 'options'])
      );
    }
    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      return statement.declaration.declarations.some(
        (declarator) =>
          t.isIdentifier(declarator.id) &&
          declarator.id.name === 'parameters' &&
          declarator.init &&
          t.isExpression(declarator.init) &&
          findPathValues(config, declarator.init, ['options', 'storySort']).length > 0 &&
          pathUsesIndirectValue(declarator.init, ['options'])
      );
    }
    if (t.isExportNamedDeclaration(statement)) {
      return statement.specifiers.some((specifier) => {
        if (
          !t.isExportSpecifier(specifier) ||
          !t.isIdentifier(specifier.local) ||
          !t.isIdentifier(specifier.exported) ||
          specifier.exported.name !== 'parameters'
        ) {
          return false;
        }
        const initialization = findVariableInitialization(config, specifier.local.name);
        return (
          initialization !== undefined &&
          findPathValues(config, initialization, ['options', 'storySort']).length > 0
        );
      });
    }
    if (
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      isModuleExports(statement.expression.left) &&
      t.isExpression(statement.expression.right) &&
      findPathValues(config, statement.expression.right, ['parameters', 'options', 'storySort'])
        .length > 0
    ) {
      return pathUsesIndirectValue(statement.expression.right, ['parameters', 'options']);
    }
    return false;
  });

const duplicatePreviewStorySortPathKey = (config: ConfigFile) => {
  if (countObjectProperties(config._exportsObject, 'parameters') > 1) {
    return 'parameters';
  }
  if (countObjectProperties(config.getFieldNode(['parameters']), 'options') > 1) {
    return 'options';
  }
  if (countObjectProperties(config.getFieldNode(['parameters', 'options']), 'storySort') > 1) {
    return 'storySort';
  }
  return undefined;
};

const objectContainsIndirectProperty = (node: t.Node | null | undefined) =>
  t.isObjectExpression(node) &&
  node.properties.some(
    (property) =>
      t.isSpreadElement(property) ||
      ((t.isObjectProperty(property) || t.isObjectMethod(property)) && property.computed)
  );

const previewStorySortPathContainsIndirectProperty = (config: ConfigFile) =>
  objectContainsIndirectProperty(config._exportsObject) ||
  [config.getFieldNode(['parameters']), config.getFieldNode(['parameters', 'options'])].some(
    objectContainsIndirectProperty
  );

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
    const storySortNode = previewConfig.getFieldNode(['parameters', 'options', 'storySort']) as
      | t.Expression
      | undefined;
    const legacyStorySort = findLegacyStorySort(previewConfig);
    const callWrappedLegacyStorySort = findCallWrappedLegacyStorySort(previewConfig);

    if (!storySortNode && legacyStorySort.length === 0 && callWrappedLegacyStorySort.length === 0) {
      return null;
    }
    const duplicatePathKey = duplicatePreviewStorySortPathKey(previewConfig);
    if (duplicatePathKey) {
      throw new Error(dedent`
        ${previewConfigPath} defines ${duplicatePathKey} more than once along the parameters.options.storySort path. Reconcile the values manually, keep the effective storySort as top-level storySort in ${mainConfigPath}, and remove all preview storySort properties.
      `);
    }
    if (legacyStorySort.length > 1) {
      throw new Error(dedent`
        ${previewConfigPath} defines parameters.options.storySort more than once. Reconcile the values manually, keep the effective storySort as top-level storySort in ${mainConfigPath}, and remove all preview storySort properties.
      `);
    }
    if (previewParametersRootCount(previewConfig) > 1) {
      throw new Error(dedent`
        ${previewConfigPath} exports parameters from more than one configuration root. Consolidate the preview parameters manually, move storySort to top-level storySort in ${mainConfigPath}, and remove all preview storySort properties.
      `);
    }
    if (
      !storySortNode ||
      legacyStorySort.length === 0 ||
      previewStorySortPathContainsIndirectProperty(previewConfig) ||
      previewStorySortPathUsesIndirectValue(previewConfig)
    ) {
      throw new Error(dedent`
        Storybook cannot safely locate parameters.options.storySort in ${previewConfigPath} because the preview configuration uses an identifier, computed property, or spread. Move it manually to top-level storySort in ${mainConfigPath}, then remove it from preview.
      `);
    }
    if (rootContainsSpread(mainConfig)) {
      throw new Error(dedent`
        Storybook cannot safely add storySort because the root of ${mainConfigPath} main config contains a spread. Add top-level storySort manually and remove parameters.options.storySort from ${previewConfigPath}.
      `);
    }
    if (mainHasUnsupportedExportShape(mainConfig)) {
      throw new Error(dedent`
        Storybook cannot safely add storySort because ${mainConfigPath} uses an unsupported main configuration export. Convert it to a writable object default export or named ESM exports, then move storySort manually and remove parameters.options.storySort from ${previewConfigPath}.
      `);
    }
    if (mainDefinesStorySort(mainConfig)) {
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
