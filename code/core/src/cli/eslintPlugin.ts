import { readFile, writeFile } from 'node:fs/promises';

import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';
import {
  type CsfValue,
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  appendToList,
  arrayList,
  generateUid,
  importedName,
  isStringLiteral,
  outerSpan,
  prependStatement,
  printString,
  readConfig,
  unwrapESTreeExpression as unwrapExpression,
  walk,
  writeConfig,
} from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import commentJson from 'comment-json';
import detectIndent from 'detect-indent';
import * as find from 'empathic/find';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

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
const FLAT_CONFIG_DOCS_COMMENT =
  '// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format';

type ConfigHelperNames = { tsEslint: string; defineConfig: string };
type ConfigTarget = E.ArrayExpression | E.CallExpression;

const isIdentifierNamed = (node: Node | null | undefined, name: string) =>
  node?.type === 'Identifier' && node.name === name;

function isRequireOf(node: Node | null | undefined, source: string): node is E.CallExpression {
  return (
    node?.type === 'CallExpression' &&
    isIdentifierNamed(node.callee, 'require') &&
    isStringLiteral(node.arguments[0]) &&
    node.arguments[0].value === source
  );
}

function findConfigHelperNames(program: E.Program): ConfigHelperNames {
  const names: ConfigHelperNames = { tsEslint: '', defineConfig: '' };
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        if (
          statement.source.value === 'typescript-eslint' &&
          specifier.type === 'ImportDefaultSpecifier'
        ) {
          names.tsEslint = specifier.local.name;
        }
        if (
          statement.source.value === 'eslint/config' &&
          specifier.type === 'ImportSpecifier' &&
          importedName(specifier.imported) === 'defineConfig'
        ) {
          names.defineConfig = specifier.local.name;
        }
      }
    }
    if (statement.type === 'VariableDeclaration') {
      for (const { id, init } of statement.declarations) {
        if (isRequireOf(init, 'typescript-eslint') && id.type === 'Identifier') {
          names.tsEslint = id.name;
        }
        if (isRequireOf(init, 'eslint/config') && id.type === 'ObjectPattern') {
          for (const property of id.properties) {
            if (
              property.type === 'Property' &&
              !property.computed &&
              isIdentifierNamed(property.key, 'defineConfig') &&
              property.value.type === 'Identifier'
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
  expression: Node | null | undefined,
  editor: SourceEditor,
  helpers: ConfigHelperNames,
  followIdentifier = true
): ConfigTarget | undefined {
  const config = unwrapExpression(expression);

  if (config?.type === 'ArrayExpression') {
    return config;
  }

  if (config?.type === 'Identifier') {
    const binding = followIdentifier ? editor.scopes.program.bindings.get(config.name) : undefined;
    if (
      binding?.constant &&
      binding.node.type === 'VariableDeclarator' &&
      binding.node.id.type === 'Identifier'
    ) {
      return findConfigTarget(binding.node.init, editor, helpers, false);
    }
    return undefined;
  }

  if (config?.type !== 'CallExpression') {
    return undefined;
  }

  if (helpers.defineConfig && isIdentifierNamed(config.callee, helpers.defineConfig)) {
    const configs = unwrapExpression(config.arguments[0] as Node | undefined);
    return configs?.type === 'ArrayExpression' ? configs : undefined;
  }

  if (
    helpers.tsEslint &&
    config.callee.type === 'MemberExpression' &&
    !config.callee.computed &&
    isIdentifierNamed(config.callee.object, helpers.tsEslint) &&
    isIdentifierNamed(config.callee.property, 'config')
  ) {
    return config;
  }

  return undefined;
}

function addStorybookConfig(editor: SourceEditor, target: ConfigTarget, localName: string) {
  const storybookConfig = `${localName}.configs[${printString('flat/recommended', editor.quote)}]`;
  if (target.type === 'ArrayExpression') {
    appendToList(editor, arrayList(editor, target), [`...${storybookConfig}`], '');
  } else {
    const open = editor.code.indexOf('(', target.callee.end) + 1;
    // An argument's item spans the parentheses around it.
    const items = target.arguments.map(outerSpan);
    appendToList(editor, { open, close: target.end - 1, items }, [storybookConfig]);
  }
}

function hasStorybookConfig(target: ConfigTarget, storybookLocalNames: Set<string>) {
  const entries = target.type === 'ArrayExpression' ? target.elements : target.arguments;
  return entries.some((entry) => {
    const config = entry?.type === 'SpreadElement' ? entry.argument : entry;
    if (
      config?.type !== 'MemberExpression' ||
      !isStringLiteral(config.property) ||
      config.property.value !== 'flat/recommended' ||
      config.object.type !== 'MemberExpression' ||
      config.object.computed ||
      !isIdentifierNamed(config.object.property, 'configs')
    ) {
      return false;
    }

    const plugin = config.object.object;
    return (
      (plugin.type === 'Identifier' && storybookLocalNames.has(plugin.name)) ||
      isRequireOf(plugin, STORYBOOK_PLUGIN)
    );
  });
}

function findCommonJsExport(program: E.Program) {
  const topLevelAssignments = new Set<Node>(
    program.body.flatMap((statement) =>
      statement.type === 'ExpressionStatement' ? [statement.expression] : []
    )
  );
  let exportedConfig: Node | undefined;
  let isSupported = true;

  walk(program, (node) => {
    if (node.type !== 'AssignmentExpression') {
      return;
    }
    const { left } = node;
    if (left.type !== 'MemberExpression' || !isIdentifierNamed(left.object, 'module')) {
      return;
    }
    if (!left.computed && !isIdentifierNamed(left.property, 'exports')) {
      return;
    }

    const isSingleTopLevelExport =
      !left.computed && !exportedConfig && node.operator === '=' && topLevelAssignments.has(node);
    if (isSingleTopLevelExport) {
      exportedConfig = node.right;
    } else {
      isSupported = false;
    }
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
  const editor = new SourceEditor(code, configFile);
  const { program } = editor;

  // Some configs load plugins with import() (e.g. eslint-flat-config-utils), where we can't safely
  // add the spread.
  let hasStorybookImport = false;
  walk(program, (node) => {
    if (
      (node.type === 'ImportDeclaration' && node.source.value === STORYBOOK_PLUGIN) ||
      (node.type === 'ImportExpression' &&
        isStringLiteral(node.source) &&
        node.source.value === STORYBOOK_PLUGIN)
    ) {
      hasStorybookImport = true;
    }
    return !hasStorybookImport;
  });
  if (hasStorybookImport) {
    return code;
  }

  const storybookRequires: { localName: string; end: number }[] = [];
  for (const statement of program.body) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations) {
      if (!isRequireOf(declarator.init, STORYBOOK_PLUGIN)) {
        continue;
      }
      // Only `const storybook = require(...)` gives a binding we can spread `storybook.configs` from
      if (declarator.id.type !== 'Identifier') {
        return code;
      }
      storybookRequires.push({ localName: declarator.id.name, end: declarator.end });
    }
  }

  const helpers = findConfigHelperNames(program);
  const commonJsExport = findCommonJsExport(program);

  if (
    commonJsExport.exportedConfig ||
    !commonJsExport.isSupported ||
    storybookRequires.length > 0
  ) {
    const target = commonJsExport.isSupported
      ? findConfigTarget(commonJsExport.exportedConfig, editor, helpers)
      : undefined;
    if (!target) {
      logger.warn(
        `Could not automatically add eslint-plugin-storybook to ${configFile}. Please add it manually: const storybook = require('eslint-plugin-storybook'); then add ...storybook.configs['flat/recommended'] to the exported config. See https://storybook.js.org/docs/configure/integration/eslint-plugin`
      );
      return code;
    }

    if (hasStorybookConfig(target, new Set(storybookRequires.map(({ localName }) => localName)))) {
      return code;
    }

    const requiredBeforeTarget = storybookRequires.find(({ end }) => end <= target.start);
    if (requiredBeforeTarget) {
      addStorybookConfig(editor, target, requiredBeforeTarget.localName);
      return editor.toString();
    }

    const localName = editor.scopes.program.bindings.has('storybook')
      ? generateUid(editor.scopes, 'storybook')
      : 'storybook';
    addStorybookConfig(editor, target, localName);
    prependStatement(
      editor,
      `${FLAT_CONFIG_DOCS_COMMENT}\nconst ${localName} = require(${printString(STORYBOOK_PLUGIN, editor.quote)});`
    );
    return editor.toString();
  }

  const exportDefault = program.body.find(
    (node): node is E.ExportDefaultDeclaration => node.type === 'ExportDefaultDeclaration'
  );
  const target = findConfigTarget(exportDefault?.declaration as Node | undefined, editor, helpers);
  if (target) {
    addStorybookConfig(editor, target, 'storybook');
  }

  prependStatement(
    editor,
    `${FLAT_CONFIG_DOCS_COMMENT}\nimport storybook from ${printString(STORYBOOK_PLUGIN, editor.quote)};`
  );

  return editor.toString();
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
