import { readFile, writeFile } from 'node:fs/promises';

import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';
import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  appendToList,
  arrayList,
  importedName,
  isStringLiteral,
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

const STORYBOOK_CONFIG = 'storybook.configs["flat/recommended"]';

export const configureFlatConfig = async (code: string) => {
  const editor = new SourceEditor(code);
  const { program } = editor;

  // Bail out if eslint-plugin-storybook is already imported (static or dynamic) to avoid
  // referencing an undefined variable or duplicating the config spread.
  // Some configs use dynamic import() expressions (e.g. via eslint-flat-config-utils).
  let alreadyHasStorybookImport = false;
  walk(program, (node) => {
    if (
      (node.type === 'ImportDeclaration' && node.source.value === 'eslint-plugin-storybook') ||
      (node.type === 'ImportExpression' &&
        isStringLiteral(node.source) &&
        node.source.value === 'eslint-plugin-storybook')
    ) {
      alreadyHasStorybookImport = true;
    }
    return !alreadyHasStorybookImport;
  });
  if (alreadyHasStorybookImport) {
    return code;
  }

  let tsEslintLocalName = '';
  let eslintDefineConfigLocalName = '';
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') {
      continue;
    }
    if (node.source.value === 'typescript-eslint') {
      const defaultSpecifier = node.specifiers.find((s) => s.type === 'ImportDefaultSpecifier');
      if (defaultSpecifier) {
        tsEslintLocalName = defaultSpecifier.local.name;
      }
    }
    if (node.source.value === 'eslint/config') {
      const defineConfigSpecifier = node.specifiers.find(
        (s) => s.type === 'ImportSpecifier' && importedName(s.imported) === 'defineConfig'
      );
      if (defineConfigSpecifier) {
        eslintDefineConfigLocalName = defineConfigSpecifier.local.name;
      }
    }
  }

  const spreadInto = (array: Node | null | undefined) => {
    const unwrapped = array && unwrapExpression(array);
    if (unwrapped?.type === 'ArrayExpression') {
      appendToList(editor, arrayList(unwrapped), [`...${STORYBOOK_CONFIG}`], '');
    }
  };
  const isDefineConfigCall = (node: Node | null | undefined): node is E.CallExpression =>
    node?.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    !!eslintDefineConfigLocalName &&
    node.callee.name === eslintDefineConfigLocalName &&
    node.arguments.length > 0;

  /**
   * What this supports:
   *
   * 1. Export default []
   * 2. Const config; export default config
   * 3. Export default tseslint.config()
   *
   * What this does NOT support:
   *
   * 1. Module.exports = [] Though it will add the import and a code comment that points to the docs
   */
  const exportDefault = program.body.find(
    (node): node is E.ExportDefaultDeclaration => node.type === 'ExportDefaultDeclaration'
  );
  const eslintConfigExpression =
    exportDefault && unwrapExpression(exportDefault.declaration as Node);

  // Case 1: Direct array
  spreadInto(eslintConfigExpression);

  // Case 2: tseslint.config(...)
  if (
    eslintConfigExpression?.type === 'CallExpression' &&
    eslintConfigExpression.callee.type === 'MemberExpression' &&
    tsEslintLocalName &&
    eslintConfigExpression.callee.object.type === 'Identifier' &&
    eslintConfigExpression.callee.object.name === tsEslintLocalName &&
    eslintConfigExpression.callee.property.type === 'Identifier' &&
    eslintConfigExpression.callee.property.name === 'config'
  ) {
    const callee = eslintConfigExpression;
    const close = callee.end - 1;
    const open = editor.code.indexOf('(', callee.callee.end) + 1;
    appendToList(editor, { open, close, items: callee.arguments }, [STORYBOOK_CONFIG], '');
  }

  // Case 2b: export default defineConfig([...]) from "eslint/config"
  if (isDefineConfigCall(eslintConfigExpression)) {
    spreadInto(eslintConfigExpression.arguments[0]);
  }

  // Case 3: export default config (resolve to array or call expression with array)
  if (eslintConfigExpression?.type === 'Identifier') {
    const binding = editor.scopes.program.bindings.get(eslintConfigExpression.name);
    if (binding?.node.type === 'VariableDeclarator' && binding.node.init) {
      const init = unwrapExpression(binding.node.init);
      if (init.type === 'ArrayExpression') {
        spreadInto(init);
      } else if (isDefineConfigCall(init)) {
        // Handle cases like defineConfig([...]) from "eslint/config"
        spreadInto(init.arguments[0]);
      }
    }
  }

  prependStatement(
    editor,
    `// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format\nimport storybook from ${printString('eslint-plugin-storybook', editor.quote)};`
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

export const normalizeExtends = (existingExtends: any): string[] => {
  if (!existingExtends) {
    return [];
  }

  if (typeof existingExtends === 'string') {
    return [existingExtends];
  }

  if (Array.isArray(existingExtends)) {
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
        const output = await configureFlatConfig(code);
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
