import { readFile, writeFile } from 'node:fs/promises';

import { paddedLog } from 'storybook/internal/common';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';

import commentJson from 'comment-json';
import detectIndent from 'detect-indent';
import { findUp } from 'find-up';
import picocolors from 'picocolors';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

import { babelParse, recast, types as t, traverse } from '../babel';

// TODO: @kasperpeulen check how to use the JSPackageManager type from common later
// Right now there is a mismatch issue with the types because conflicts with baseGenerator.ts
type JsPackageManager = any;

export const SUPPORTED_ESLINT_EXTENSIONS = ['ts', 'mts', 'cts', 'mjs', 'js', 'cjs', 'json'];
const UNSUPPORTED_ESLINT_EXTENSIONS = ['yaml', 'yml'];

export const findEslintFile = async () => {
  const filePrefixes = ['eslint.config', '.eslintrc'];

  // Check for unsupported files
  for (const prefix of filePrefixes) {
    for (const ext of UNSUPPORTED_ESLINT_EXTENSIONS) {
      const file = await findUp(`${prefix}.${ext}`);
      if (file) {
        throw new Error(`Unsupported ESLint config extension: .${ext}`);
      }
    }
  }

  // Find supported ESLint config files
  for (const prefix of filePrefixes) {
    for (const ext of SUPPORTED_ESLINT_EXTENSIONS) {
      const file = await findUp(`${prefix}.${ext}`);
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

  let tsEslintLocalName = '';
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
    },

    ExportDefaultDeclaration(path) {
      const node = path.node;
      eslintConfigExpression = unwrapTSExpression(node.declaration);

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

      // Case 3: export default config (resolve to array)
      if (t.isIdentifier(eslintConfigExpression)) {
        const binding = path.scope.getBinding(eslintConfigExpression.name);
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          const init = unwrapTSExpression(binding.path.node.init);

          if (t.isArrayExpression(init)) {
            init.elements.push(t.spreadElement(storybookConfig));
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
        (importDecl as any).comments = [
          {
            type: 'CommentLine',
            value:
              ' For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format',
          },
        ];
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
  const allDependencies = await packageManager.getAllDependencies();
  const packageJson = await packageManager.retrievePackageJson();
  let eslintConfigFile: string | undefined = undefined;

  try {
    eslintConfigFile = await findEslintFile();
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
    paddedLog(`Configuring Storybook ESLint plugin at ${eslintConfigFile}`);
    if (eslintConfigFile.endsWith('json')) {
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
        const code = await readFile(eslintConfigFile, { encoding: 'utf8' });
        const output = await configureFlatConfig(code);
        await writeFile(eslintConfigFile, output);
      } else {
        const eslint = await readConfig(eslintConfigFile);
        const existingExtends = normalizeExtends(eslint.getFieldValue(['extends'])).filter(Boolean);

        if (existingExtends.includes('plugin:storybook/recommended')) {
          return;
        }

        eslint.setFieldValue(['extends'], [...existingExtends, 'plugin:storybook/recommended']);

        await writeConfig(eslint);
      }
    }
  } else {
    paddedLog(`Configuring eslint-plugin-storybook in your package.json`);
    const packageJson = await packageManager.retrievePackageJson();
    const existingExtends = normalizeExtends(packageJson.eslintConfig?.extends).filter(Boolean);

    await packageManager.writePackageJson({
      ...packageJson,
      eslintConfig: {
        ...packageJson.eslintConfig,
        extends: [...existingExtends, 'plugin:storybook/recommended'],
      },
    });
  }
}

export const suggestESLintPlugin = async (): Promise<boolean> => {
  const { shouldInstall } = await prompts({
    type: 'confirm',
    name: 'shouldInstall',
    message: dedent`
        We have detected that you're using ESLint. Storybook provides a plugin that gives the best experience with Storybook and helps follow best practices: ${picocolors.yellow(
          'https://storybook.js.org/docs/9/configure/integration/eslint-plugin'
        )}

        Would you like to install it?
      `,
    initial: true,
  });

  return shouldInstall;
};
