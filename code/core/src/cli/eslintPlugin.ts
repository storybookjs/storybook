import { readFile, writeFile } from 'node:fs/promises';

import {
  type JsPackageManager,
  formatExistingFile,
  getProjectRoot,
} from 'storybook/internal/common';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import commentJson from 'comment-json';
import detectIndent from 'detect-indent';
import * as find from 'empathic/find';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { babelParse, types as t, traverse } from '../babel/index.ts';

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

function unwrapTSExpression(expr: any): t.Expression | null | undefined {
  if (!expr) {
    return expr;
  }

  if (t.isTSAsExpression(expr) || t.isTSSatisfiesExpression(expr)) {
    return unwrapTSExpression(expr.expression);
  }
  return expr;
}

export const configureFlatConfig = async (code: string) => {
  const ast = babelParse(code);

  // Bail out if eslint-plugin-storybook is already imported (static or dynamic) to avoid
  // referencing an undefined variable or duplicating the config spread.
  // Some configs use dynamic import() expressions (e.g. via eslint-flat-config-utils).
  let alreadyHasStorybookImport = false;
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'eslint-plugin-storybook') {
        alreadyHasStorybookImport = true;
        path.stop();
      }
    },
    CallExpression(path) {
      // Dynamic import: import('eslint-plugin-storybook')
      // Babel represents this as a CallExpression with callee.type === 'Import'
      if (
        t.isImport(path.node.callee) &&
        path.node.arguments.length > 0 &&
        t.isStringLiteral(path.node.arguments[0]) &&
        path.node.arguments[0].value === 'eslint-plugin-storybook'
      ) {
        alreadyHasStorybookImport = true;
        path.stop();
      }
    },
  });
  if (alreadyHasStorybookImport) {
    return code;
  }

  const targets: { node: t.Node; items: (t.Node | null)[]; spread: boolean }[] = [];
  let hasImportAlready = false;
  let lastImport: t.ImportDeclaration | undefined;
  let tsEslintLocalName = '';
  let eslintDefineConfigLocalName = '';
  let eslintConfigExpression: any = null;

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
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'typescript-eslint') {
        const defaultSpecifier = path.node.specifiers.find((s) => t.isImportDefaultSpecifier(s));
        if (defaultSpecifier) {
          tsEslintLocalName = defaultSpecifier.local.name;
        }
      }
      if (path.node.source.value === 'eslint/config') {
        const defineConfigSpecifier = path.node.specifiers.find(
          (s) => t.isImportSpecifier(s) && t.isIdentifier(s.imported, { name: 'defineConfig' })
        );
        if (defineConfigSpecifier && t.isImportSpecifier(defineConfigSpecifier)) {
          eslintDefineConfigLocalName = defineConfigSpecifier.local.name;
        }
      }
    },

    ExportDefaultDeclaration(path) {
      const node = path.node;
      eslintConfigExpression = unwrapTSExpression(node.declaration);

      // Case 1: Direct array
      if (t.isArrayExpression(eslintConfigExpression)) {
        targets.push({
          node: eslintConfigExpression,
          items: eslintConfigExpression.elements,
          spread: true,
        });
      }

      // Case 2: tseslint.config(...)
      if (
        t.isCallExpression(eslintConfigExpression) &&
        t.isMemberExpression(eslintConfigExpression.callee) &&
        tsEslintLocalName &&
        t.isIdentifier(eslintConfigExpression.callee.object, { name: tsEslintLocalName }) &&
        t.isIdentifier(eslintConfigExpression.callee.property, { name: 'config' })
      ) {
        targets.push({
          node: eslintConfigExpression,
          items: eslintConfigExpression.arguments,
          spread: false,
        });
      }

      // Case 2b: export default defineConfig([...]) from "eslint/config"
      if (
        t.isCallExpression(eslintConfigExpression) &&
        t.isIdentifier(eslintConfigExpression.callee) &&
        eslintDefineConfigLocalName &&
        eslintConfigExpression.callee.name === eslintDefineConfigLocalName &&
        eslintConfigExpression.arguments.length > 0
      ) {
        const firstArg = eslintConfigExpression.arguments[0];
        if (t.isExpression(firstArg)) {
          const unwrappedArg = unwrapTSExpression(firstArg);
          if (unwrappedArg && t.isArrayExpression(unwrappedArg)) {
            targets.push({ node: unwrappedArg, items: unwrappedArg.elements, spread: true });
          }
        }
      }

      // Case 3: export default config (resolve to array or call expression with array)
      if (t.isIdentifier(eslintConfigExpression)) {
        const binding = path.scope.getBinding(eslintConfigExpression.name);
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          const init = unwrapTSExpression(binding.path.node.init);

          if (t.isArrayExpression(init)) {
            targets.push({ node: init, items: init.elements, spread: true });
          } else if (
            t.isCallExpression(init) &&
            init.arguments.length > 0 &&
            t.isIdentifier(init.callee) &&
            eslintDefineConfigLocalName &&
            init.callee.name === eslintDefineConfigLocalName
          ) {
            // Handle cases like defineConfig([...]) from "eslint/config"
            const firstArg = init.arguments[0];
            if (t.isExpression(firstArg)) {
              const unwrappedArg = unwrapTSExpression(firstArg);
              if (unwrappedArg && t.isArrayExpression(unwrappedArg)) {
                targets.push({ node: unwrappedArg, items: unwrappedArg.elements, spread: true });
              }
            }
          }
        }
      }
    },

    Program(path) {
      hasImportAlready = path.node.body.some(
        (node) => t.isImportDeclaration(node) && node.source.value === 'eslint-plugin-storybook'
      );
      lastImport = path.node.body.filter((node) => t.isImportDeclaration(node)).at(-1);
    },
  });

  const quote = (code.match(/'/g) ?? []).length >= (code.match(/"/g) ?? []).length ? "'" : '"';
  const storybookConfig = `storybook.configs[${quote}flat/recommended${quote}]`;
  const insertions = targets.map(({ node, items, spread }) =>
    insertLast(code, node, items, spread ? `...${storybookConfig}` : storybookConfig)
  );
  if (!hasImportAlready) {
    const importText = `// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format\nimport storybook from ${quote}eslint-plugin-storybook${quote};\n`;
    insertions.push(
      lastImport
        ? { at: lastImport.end!, text: `\n${importText.trimEnd()}` }
        : { at: 0, text: `${importText}\n` }
    );
  }
  return insertions
    .sort((a, b) => b.at - a.at)
    .reduce((result, { at, text }) => result.slice(0, at) + text + result.slice(at), code);
};

// Append `text` as the last item of an array literal or argument list, in the list's own layout.
const insertLast = (code: string, node: t.Node, items: (t.Node | null)[], text: string) => {
  const close = code.lastIndexOf(t.isArrayExpression(node) ? ']' : ')', node.end! - 1);
  const last = items.at(-1);
  if (!last) {
    return { at: close, text };
  }
  const afterLast = code.slice(last.end!, close);
  const trailingComma = afterLast.indexOf(',');
  const lineStart = code.lastIndexOf('\n', last.start!) + 1;
  const multiline = code.slice(last.end!, close).includes('\n');
  const indent = code.slice(lineStart, last.start!).match(/^\s*/)![0];
  const separator = multiline ? `\n${indent}` : ' ';
  return trailingComma === -1
    ? { at: last.end!, text: `,${separator}${text}` }
    : { at: last.end! + trailingComma + 1, text: `${separator}${text},` };
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
        await writeFile(eslintConfigFile, await formatExistingFile(eslintConfigFile, output));
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
