import { readFile, writeFile } from 'node:fs/promises';

import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';
import { type CsfValue, readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import commentJson from 'comment-json';
import detectIndent from 'detect-indent';
import * as find from 'empathic/find';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { babelParse, recast, types as t, traverse } from '../babel/index.ts';

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

function unwrapTSExpression(
  expr: t.Expression | null | undefined
): t.Expression | null | undefined {
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

  let alreadyHasStorybookImport = false;
  let commonJsStorybookLocalName = '';
  const commonJsStorybookLocalNames = new Set<string>();
  let commonJsStorybookRequirePosition: number | undefined;
  let programBindingNames = new Set<string>();
  traverse(ast, {
    Program(path) {
      programBindingNames = new Set(Object.keys(path.scope.bindings));
    },
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

      if (
        t.isIdentifier(path.node.callee, { name: 'require' }) &&
        path.node.arguments.length > 0 &&
        t.isStringLiteral(path.node.arguments[0]) &&
        path.node.arguments[0].value === 'eslint-plugin-storybook'
      ) {
        const declaratorPath = path.parentPath;
        if (
          declaratorPath?.isVariableDeclarator() &&
          declaratorPath.parentPath?.parentPath?.isProgram()
        ) {
          if (t.isIdentifier(declaratorPath.node.id)) {
            commonJsStorybookLocalName = declaratorPath.node.id.name;
            commonJsStorybookLocalNames.add(commonJsStorybookLocalName);
            if (typeof declaratorPath.parentPath.key === 'number') {
              commonJsStorybookRequirePosition = declaratorPath.parentPath.key;
            }
          } else {
            alreadyHasStorybookImport = true;
            path.stop();
          }
        }
      }
    },
  });
  if (alreadyHasStorybookImport) {
    return code;
  }

  let commonJsConfig: t.ArrayExpression | undefined;
  let commonJsExportPosition: number | undefined;
  let commonJsExportCount = 0;
  let hasUnsupportedCommonJsConfig = false;

  traverse(ast, {
    AssignmentExpression(path) {
      const { left } = path.node;
      if (!t.isMemberExpression(left) || !t.isIdentifier(left.object, { name: 'module' })) {
        return;
      }

      if (left.computed) {
        hasUnsupportedCommonJsConfig = true;
        return;
      }

      const isModuleExports = t.isIdentifier(left.property, { name: 'exports' });
      if (!isModuleExports) {
        return;
      }

      if (path.node.operator !== '=') {
        hasUnsupportedCommonJsConfig = true;
        return;
      }

      if (!path.parentPath?.isExpressionStatement() || !path.parentPath.parentPath?.isProgram()) {
        hasUnsupportedCommonJsConfig = true;
        return;
      }

      commonJsExportCount += 1;
      commonJsExportPosition = ast.program.body.indexOf(path.parentPath.node);
      const exportedConfig = unwrapTSExpression(path.node.right);
      if (commonJsExportCount === 1 && t.isArrayExpression(exportedConfig)) {
        commonJsConfig = exportedConfig;
      } else {
        hasUnsupportedCommonJsConfig = true;
      }
    },
  });

  if (hasUnsupportedCommonJsConfig || commonJsExportCount > 1) {
    logger.warn(
      "Could not automatically configure eslint-plugin-storybook. CommonJS ESLint flat configs must export an array, for example: const storybook = require('eslint-plugin-storybook'); module.exports = [...storybook.configs['flat/recommended']];"
    );
    return code;
  }

  if (commonJsConfig) {
    const canReuseCommonJsStorybookBinding =
      commonJsStorybookLocalName &&
      commonJsStorybookRequirePosition !== undefined &&
      commonJsExportPosition !== undefined &&
      commonJsStorybookRequirePosition < commonJsExportPosition;
    const storybookLocalName = canReuseCommonJsStorybookBinding
      ? commonJsStorybookLocalName
      : 'storybook';
    const storybookIdentifier = t.identifier(storybookLocalName);
    const storybookConfig = t.memberExpression(
      t.memberExpression(storybookIdentifier, t.identifier('configs')),
      t.stringLiteral('flat/recommended'),
      true
    );
    const alreadyHasStorybookConfig = commonJsConfig.elements.some((element) => {
      if (
        !t.isSpreadElement(element) ||
        !t.isMemberExpression(element.argument) ||
        !t.isStringLiteral(element.argument.property, { value: 'flat/recommended' }) ||
        !t.isMemberExpression(element.argument.object) ||
        !t.isIdentifier(element.argument.object.property, { name: 'configs' })
      ) {
        return false;
      }

      const configObject = element.argument.object.object;
      return (
        (t.isIdentifier(configObject) && commonJsStorybookLocalNames.has(configObject.name)) ||
        (t.isCallExpression(configObject) &&
          t.isIdentifier(configObject.callee, { name: 'require' }) &&
          t.isStringLiteral(configObject.arguments[0], { value: 'eslint-plugin-storybook' }))
      );
    });
    if (alreadyHasStorybookConfig) {
      return code;
    }
    commonJsConfig.elements.push(t.spreadElement(storybookConfig));

    if (!canReuseCommonJsStorybookBinding) {
      let generatedStorybookName = 'storybook';
      let suffix = 0;
      while (programBindingNames.has(generatedStorybookName)) {
        suffix += 1;
        generatedStorybookName = `_storybook${suffix > 1 ? suffix : ''}`;
      }
      const generatedStorybookIdentifier = t.identifier(generatedStorybookName);
      storybookIdentifier.name = generatedStorybookIdentifier.name;
      const storybookRequire = t.variableDeclaration('const', [
        t.variableDeclarator(
          generatedStorybookIdentifier,
          t.callExpression(t.identifier('require'), [t.stringLiteral('eslint-plugin-storybook')])
        ),
      ]);
      Object.assign(storybookRequire, {
        comments: [
          {
            type: 'CommentLine',
            value:
              ' For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format',
          },
        ],
      });
      ast.program.body.unshift(storybookRequire);
    }

    return recast.print(ast).code;
  }

  let tsEslintLocalName = '';
  let eslintDefineConfigLocalName = '';
  let eslintConfigExpression: t.Expression | null | undefined = null;

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
      if (t.isExpression(node.declaration)) {
        eslintConfigExpression = unwrapTSExpression(node.declaration);
      }

      const storybookConfig = t.memberExpression(
        t.memberExpression(t.identifier('storybook'), t.identifier('configs')),
        t.stringLiteral('flat/recommended'),
        true
      );

      // Case 1: Direct array
      if (t.isArrayExpression(eslintConfigExpression)) {
        eslintConfigExpression.elements.push(t.spreadElement(storybookConfig));
      }

      // Case 2: tseslint.config(...)
      if (
        t.isCallExpression(eslintConfigExpression) &&
        t.isMemberExpression(eslintConfigExpression.callee) &&
        tsEslintLocalName &&
        t.isIdentifier(eslintConfigExpression.callee.object, { name: tsEslintLocalName }) &&
        t.isIdentifier(eslintConfigExpression.callee.property, { name: 'config' })
      ) {
        eslintConfigExpression.arguments.push(storybookConfig);
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
            unwrappedArg.elements.push(t.spreadElement(storybookConfig));
          }
        }
      }

      // Case 3: export default config (resolve to array or call expression with array)
      if (t.isIdentifier(eslintConfigExpression)) {
        const binding = path.scope.getBinding(eslintConfigExpression.name);
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          const init = unwrapTSExpression(binding.path.node.init);

          if (t.isArrayExpression(init)) {
            init.elements.push(t.spreadElement(storybookConfig));
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
                unwrappedArg.elements.push(t.spreadElement(storybookConfig));
              }
            }
          }
        }
      }
    },

    Program(path) {
      const alreadyImported = path.node.body.some(
        (node) => t.isImportDeclaration(node) && node.source.value === 'eslint-plugin-storybook'
      );

      if (!alreadyImported) {
        // Add import: import storybook from 'eslint-plugin-storybook'
        const importDecl = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier('storybook'))],
          t.stringLiteral('eslint-plugin-storybook')
        );
        Object.assign(importDecl, {
          comments: [
            {
              type: 'CommentLine',
              value:
                ' For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format',
            },
          ],
        });
        path.node.body.unshift(importDecl);
      }
    },
  });

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
