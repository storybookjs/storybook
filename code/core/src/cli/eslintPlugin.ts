import { readFile, writeFile } from 'node:fs/promises';

import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';
import { type CsfValue, readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import commentJson from 'comment-json';
import detectIndent from 'detect-indent';
import * as find from 'empathic/find';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { type NodePath, babelParse, recast, types as t, traverse } from '../babel/index.ts';

export const SUPPORTED_ESLINT_EXTENSIONS = ['ts', 'mts', 'cts', 'mjs', 'js', 'cjs', 'json'];
const UNSUPPORTED_ESLINT_EXTENSIONS = ['yaml', 'yml'];

export const findEslintFile = (instanceDir: string) => {
  const filePrefixes = ['eslint.config', '.eslintrc'];

  // Check for unsupported files
  for (const prefix of filePrefixes) {
    for (const ext of UNSUPPORTED_ESLINT_EXTENSIONS) {
      const file = find.up(`${prefix}.${ext}`, { cwd: instanceDir, last: getProjectRoot() });
      if (file) {
        throw new Error(`Unsupported ESLint config extension: .${ext}`);
      }
    }
  }

  // Find supported ESLint config files
  for (const prefix of filePrefixes) {
    for (const ext of SUPPORTED_ESLINT_EXTENSIONS) {
      const file = find.up(`${prefix}.${ext}`, { cwd: instanceDir, last: getProjectRoot() });
      if (file) {
        return file;
      }
    }
  }

  return undefined;
};

const STORYBOOK_PLUGIN = 'eslint-plugin-storybook';
const FLAT_CONFIG_DOCS_COMMENT = {
  type: 'CommentLine',
  value:
    ' For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format',
};

type Scope = NodePath['scope'];
type ConfigHelperNames = { tsEslint: string; defineConfig: string };
type ConfigTarget = t.ArrayExpression | t.CallExpression;

function unwrapTSExpression(expr: t.Node | null | undefined): t.Node | null | undefined {
  if (t.isTSAsExpression(expr) || t.isTSSatisfiesExpression(expr)) {
    return unwrapTSExpression(expr.expression);
  }
  return expr;
}

function isRequireOf(node: t.Node | null | undefined, source: string): node is t.CallExpression {
  return (
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee, { name: 'require' }) &&
    t.isStringLiteral(node.arguments[0], { value: source })
  );
}

function findConfigHelperNames(program: t.Program): ConfigHelperNames {
  const names: ConfigHelperNames = { tsEslint: '', defineConfig: '' };
  for (const statement of program.body) {
    if (t.isImportDeclaration(statement)) {
      for (const specifier of statement.specifiers) {
        if (
          statement.source.value === 'typescript-eslint' &&
          t.isImportDefaultSpecifier(specifier)
        ) {
          names.tsEslint = specifier.local.name;
        }
        if (
          statement.source.value === 'eslint/config' &&
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: 'defineConfig' })
        ) {
          names.defineConfig = specifier.local.name;
        }
      }
    }
    if (t.isVariableDeclaration(statement)) {
      for (const { id, init } of statement.declarations) {
        if (isRequireOf(init, 'typescript-eslint') && t.isIdentifier(id)) {
          names.tsEslint = id.name;
        }
        if (isRequireOf(init, 'eslint/config') && t.isObjectPattern(id)) {
          for (const property of id.properties) {
            if (
              t.isObjectProperty(property) &&
              t.isIdentifier(property.key, { name: 'defineConfig' }) &&
              t.isIdentifier(property.value)
            ) {
              names.defineConfig = property.value.name;
            }
          }
        }
      }
    }
  }
  return names;
}

function findConfigTarget(
  expression: t.Node | null | undefined,
  scope: Scope,
  helpers: ConfigHelperNames,
  followIdentifier = true
): ConfigTarget | undefined {
  const config = unwrapTSExpression(expression);

  if (t.isArrayExpression(config)) {
    return config;
  }

  if (t.isIdentifier(config) && followIdentifier) {
    const binding = scope.getBinding(config.name);
    if (
      binding?.constant &&
      binding.path.isVariableDeclarator() &&
      t.isIdentifier(binding.path.node.id)
    ) {
      return findConfigTarget(binding.path.node.init, scope, helpers, false);
    }
    return undefined;
  }

  if (!t.isCallExpression(config)) {
    return undefined;
  }

  if (helpers.defineConfig && t.isIdentifier(config.callee, { name: helpers.defineConfig })) {
    const configs = unwrapTSExpression(config.arguments[0]);
    return t.isArrayExpression(configs) ? configs : undefined;
  }

  if (
    helpers.tsEslint &&
    t.isMemberExpression(config.callee) &&
    t.isIdentifier(config.callee.object, { name: helpers.tsEslint }) &&
    t.isIdentifier(config.callee.property, { name: 'config' })
  ) {
    return config;
  }

  return undefined;
}

function addStorybookConfig(target: ConfigTarget, storybookLocalName: string) {
  const storybookConfig = t.memberExpression(
    t.memberExpression(t.identifier(storybookLocalName), t.identifier('configs')),
    t.stringLiteral('flat/recommended'),
    true
  );
  if (t.isArrayExpression(target)) {
    target.elements.push(t.spreadElement(storybookConfig));
  } else {
    target.arguments.push(storybookConfig);
  }
}

function hasStorybookConfig(target: ConfigTarget, storybookLocalNames: Set<string>) {
  const entries = t.isArrayExpression(target) ? target.elements : target.arguments;
  return entries.some((entry) => {
    const config = t.isSpreadElement(entry) ? entry.argument : entry;
    if (
      !t.isMemberExpression(config) ||
      !t.isStringLiteral(config.property, { value: 'flat/recommended' }) ||
      !t.isMemberExpression(config.object) ||
      !t.isIdentifier(config.object.property, { name: 'configs' })
    ) {
      return false;
    }

    const plugin = config.object.object;
    return (
      (t.isIdentifier(plugin) && storybookLocalNames.has(plugin.name)) ||
      isRequireOf(plugin, STORYBOOK_PLUGIN)
    );
  });
}

function findCommonJsExport(ast: t.File) {
  let exportedConfig: t.Expression | undefined;
  let isSupported = true;

  traverse(ast, {
    AssignmentExpression(path) {
      const { left } = path.node;
      if (!t.isMemberExpression(left) || !t.isIdentifier(left.object, { name: 'module' })) {
        return;
      }
      if (!left.computed && !t.isIdentifier(left.property, { name: 'exports' })) {
        return;
      }

      const isSingleTopLevelExport =
        !left.computed &&
        !exportedConfig &&
        path.node.operator === '=' &&
        path.parentPath?.isExpressionStatement() &&
        path.parentPath.parentPath?.isProgram();
      if (isSingleTopLevelExport) {
        exportedConfig = path.node.right;
      } else {
        isSupported = false;
      }
    },
  });

  return { exportedConfig, isSupported };
}

/**
 * Add the recommended Storybook config to an ESLint flat config, written as `export default` or
 * `module.exports =`. Supported config shapes:
 *
 * 1. `[...]`
 * 2. `defineConfig([...])` from `eslint/config`
 * 3. `tseslint.config(...)` from `typescript-eslint`
 * 4. A top-level variable holding one of the above
 *
 * For any other ES module config, only the import is added. Any other CommonJS config is left
 * unchanged, with a warning to add the Storybook config manually.
 */
export const configureFlatConfig = async (code: string, configFile: string) => {
  const ast = babelParse(code);

  let hasStorybookImport = false;
  let hasDestructuredStorybookRequire = false;
  const storybookRequires: { localName: string; end: number }[] = [];
  let programScope = undefined as Scope | undefined;
  traverse(ast, {
    Program(path) {
      programScope = path.scope;
    },
    ImportDeclaration(path) {
      if (path.node.source.value === STORYBOOK_PLUGIN) {
        hasStorybookImport = true;
        path.stop();
      }
    },
    CallExpression(path) {
      // Some configs load plugins with import() (e.g. eslint-flat-config-utils), where we can't safely add the spread
      if (
        t.isImport(path.node.callee) &&
        t.isStringLiteral(path.node.arguments[0], { value: STORYBOOK_PLUGIN })
      ) {
        hasStorybookImport = true;
        path.stop();
        return;
      }

      const declarator = path.parentPath;
      if (
        !isRequireOf(path.node, STORYBOOK_PLUGIN) ||
        !declarator?.isVariableDeclarator() ||
        !declarator.parentPath.parentPath?.isProgram()
      ) {
        return;
      }

      // Only `const storybook = require(...)` gives a binding we can spread `storybook.configs` from
      if (t.isIdentifier(declarator.node.id)) {
        storybookRequires.push({
          localName: declarator.node.id.name,
          end: declarator.node.end ?? 0,
        });
      } else {
        hasDestructuredStorybookRequire = true;
        path.stop();
      }
    },
  });
  if (hasStorybookImport || hasDestructuredStorybookRequire || !programScope) {
    return code;
  }

  const helpers = findConfigHelperNames(ast.program);
  const commonJsExport = findCommonJsExport(ast);

  if (
    commonJsExport.exportedConfig ||
    !commonJsExport.isSupported ||
    storybookRequires.length > 0
  ) {
    const target =
      commonJsExport.isSupported &&
      findConfigTarget(commonJsExport.exportedConfig, programScope, helpers);
    if (!target) {
      logger.warn(
        `Could not automatically add eslint-plugin-storybook to ${configFile}. Please add it manually: const storybook = require('eslint-plugin-storybook'); then add ...storybook.configs['flat/recommended'] to the exported config. See https://storybook.js.org/docs/configure/integration/eslint-plugin`
      );
      return code;
    }

    if (hasStorybookConfig(target, new Set(storybookRequires.map(({ localName }) => localName)))) {
      return code;
    }

    const requiredBeforeTarget = storybookRequires.find(({ end }) => end <= (target.start ?? 0));
    if (requiredBeforeTarget) {
      addStorybookConfig(target, requiredBeforeTarget.localName);
      return recast.print(ast).code;
    }

    let localName = 'storybook';
    for (let suffix = 1; programScope.hasBinding(localName); suffix++) {
      localName = `_storybook${suffix > 1 ? suffix : ''}`;
    }
    addStorybookConfig(target, localName);
    const storybookRequire = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier(localName),
        t.callExpression(t.identifier('require'), [t.stringLiteral(STORYBOOK_PLUGIN)])
      ),
    ]);
    Object.assign(storybookRequire, { comments: [FLAT_CONFIG_DOCS_COMMENT] });
    ast.program.body.unshift(storybookRequire);
    return recast.print(ast).code;
  }

  const exportDefault = ast.program.body.find((statement) =>
    t.isExportDefaultDeclaration(statement)
  ) as t.ExportDefaultDeclaration | undefined;
  const target = findConfigTarget(exportDefault?.declaration, programScope, helpers);
  if (target) {
    addStorybookConfig(target, 'storybook');
  }

  const importDecl = t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier('storybook'))],
    t.stringLiteral(STORYBOOK_PLUGIN)
  );
  Object.assign(importDecl, { comments: [FLAT_CONFIG_DOCS_COMMENT] });
  ast.program.body.unshift(importDecl);

  return recast.print(ast).code;
};

export async function extractEslintInfo(packageManager: JsPackageManager): Promise<{
  hasEslint: boolean;
  isStorybookPluginInstalled: boolean;
  eslintConfigFile: string | undefined;
  unsupportedExtension?: string;
  isFlatConfig: boolean;
}> {
  let unsupportedExtension = undefined;
  const allDependencies = packageManager.getAllDependencies();
  const { packageJson } = packageManager.primaryPackageJson;
  let eslintConfigFile: string | undefined = undefined;

  try {
    eslintConfigFile = findEslintFile(packageManager.instanceDir);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unsupported ESLint')) {
      unsupportedExtension = String(err);
    } else {
      throw err;
    }
  }

  const isStorybookPluginInstalled = !!allDependencies['eslint-plugin-storybook'];
  const hasEslint = allDependencies.eslint || eslintConfigFile || packageJson.eslintConfig;
  return {
    hasEslint: !!hasEslint,
    isStorybookPluginInstalled,
    eslintConfigFile,
    unsupportedExtension,
    isFlatConfig: !!(eslintConfigFile && eslintConfigFile.match(/eslint\.config\.[^/]+/)),
  };
}

export const normalizeExtends = (existingExtends: CsfValue): string[] => {
  if (!existingExtends) {
    return [];
  }

  if (typeof existingExtends === 'string') {
    return [existingExtends];
  }

  if (
    Array.isArray(existingExtends) &&
    existingExtends.every((extension) => typeof extension === 'string')
  ) {
    return existingExtends;
  }
  throw new Error(`Invalid eslint extends ${existingExtends}`);
};

export async function configureEslintPlugin({
  eslintConfigFile,
  packageManager,
  isFlatConfig,
}: {
  eslintConfigFile: string | undefined;
  packageManager: JsPackageManager;
  isFlatConfig: boolean;
}) {
  if (eslintConfigFile) {
    if (eslintConfigFile.endsWith('json')) {
      logger.debug(`Detected JSON config at ${eslintConfigFile}`);
      const eslintFileContents = await readFile(eslintConfigFile, { encoding: 'utf8' });
      const eslintConfig = commentJson.parse(eslintFileContents) as {
        extends?: string[];
      };
      const existingExtends = normalizeExtends(eslintConfig.extends).filter(Boolean);

      if (existingExtends.includes('plugin:storybook/recommended')) {
        return;
      }

      if (!Array.isArray(eslintConfig.extends)) {
        eslintConfig.extends = eslintConfig.extends ? [eslintConfig.extends] : [];
      }
      eslintConfig.extends.push('plugin:storybook/recommended');

      const spaces = detectIndent(eslintFileContents).amount || 2;
      await writeFile(eslintConfigFile, commentJson.stringify(eslintConfig, null, spaces));
    } else {
      if (isFlatConfig) {
        logger.debug(`Detected flat config at ${eslintConfigFile}`);
        const code = await readFile(eslintConfigFile, { encoding: 'utf8' });
        const output = await configureFlatConfig(code, eslintConfigFile);
        if (output === code) {
          return;
        }
        await writeFile(eslintConfigFile, output);
      } else {
        const eslint = await readConfig(eslintConfigFile);
        const existingExtends = normalizeExtends(eslint.getValue(['extends'])).filter(Boolean);

        if (existingExtends.includes('plugin:storybook/recommended')) {
          return;
        }

        eslint.set(['extends'], [...existingExtends, 'plugin:storybook/recommended']);

        await writeConfig(eslint);
      }
    }
  } else {
    logger.debug('No ESLint config file found, configuring in package.json instead');
    const { packageJson, operationDir } = packageManager.primaryPackageJson;
    const existingExtends = normalizeExtends(packageJson.eslintConfig?.extends).filter(Boolean);

    packageJson.eslintConfig = {
      ...packageJson.eslintConfig,
      extends: [...existingExtends, 'plugin:storybook/recommended'],
    };

    packageManager.writePackageJson(packageJson, operationDir);
  }
}

export const suggestESLintPlugin = async (): Promise<boolean> => {
  const shouldInstall = await prompt.confirm({
    message: dedent`
        We have detected that you're using ESLint. Storybook provides a plugin that gives the best experience with Storybook and helps follow best practices: ${picocolors.yellow(
          'https://storybook.js.org/docs/configure/integration/eslint-plugin'
        )}

        Would you like to install it?
      `,
    initialValue: true,
  });

  return shouldInstall;
};
