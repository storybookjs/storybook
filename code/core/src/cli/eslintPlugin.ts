import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import type { JsPackageManager } from 'storybook/internal/common';
import { paddedLog } from 'storybook/internal/common';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';

import detectIndent from 'detect-indent';
import picocolors from 'picocolors';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

export const SUPPORTED_ESLINT_EXTENSIONS = ['ts', 'mts', 'cts', 'mjs', 'js', 'cjs', 'json'];
const UNSUPPORTED_ESLINT_EXTENSIONS = ['yaml', 'yml'];

export const findEslintFile = () => {
  let filePrefix = 'eslint.config';
  // Check for flat config first eslint.config.*
  const flatConfigFile = SUPPORTED_ESLINT_EXTENSIONS.find((ext) =>
    existsSync(`${filePrefix}.${ext}`)
  );
  if (flatConfigFile) {
    return `${filePrefix}.${flatConfigFile}`;
  }

  // Otherwise, check for .eslintrc.*
  filePrefix = '.eslintrc';
  const unsupportedExtension = UNSUPPORTED_ESLINT_EXTENSIONS.find((ext: string) =>
    existsSync(`${filePrefix}.${ext}`)
  );

  if (unsupportedExtension) {
    throw new Error(unsupportedExtension);
  }

  const extension = SUPPORTED_ESLINT_EXTENSIONS.find((ext: string) =>
    existsSync(`${filePrefix}.${ext}`)
  );
  return extension ? `${filePrefix}.${extension}` : null;
};

export async function extractEslintInfo(packageManager: JsPackageManager): Promise<{
  hasEslint: boolean;
  isStorybookPluginInstalled: boolean;
  eslintConfigFile: string | null;
  isFlatConfig: boolean;
}> {
  const allDependencies = await packageManager.getAllDependencies();
  const packageJson = await packageManager.retrievePackageJson();
  let eslintConfigFile: string | null = null;

  try {
    eslintConfigFile = findEslintFile();
  } catch (err) {
    //
  }

  const isStorybookPluginInstalled = !!allDependencies['eslint-plugin-storybook'];
  const hasEslint = allDependencies.eslint || eslintConfigFile || packageJson.eslintConfig;
  return {
    hasEslint,
    isStorybookPluginInstalled,
    eslintConfigFile,
    isFlatConfig: !!eslintConfigFile?.startsWith('eslint.config'),
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

export async function configureEslintPlugin(
  eslintFile: string | undefined,
  packageManager: JsPackageManager
) {
  if (eslintFile) {
    paddedLog(`Configuring Storybook ESLint plugin at ${eslintFile}`);
    if (eslintFile.endsWith('json')) {
      const eslintConfig = JSON.parse(await readFile(eslintFile, { encoding: 'utf8' })) as {
        extends?: string[];
      };
      const existingExtends = normalizeExtends(eslintConfig.extends).filter(Boolean);
      eslintConfig.extends = [...existingExtends, 'plugin:storybook/recommended'] as string[];

      const eslintFileContents = await readFile(eslintFile, { encoding: 'utf8' });
      const spaces = detectIndent(eslintFileContents).amount || 2;
      await writeFile(eslintFile, JSON.stringify(eslintConfig, undefined, spaces));
    } else {
      const eslint = await readConfig(eslintFile);
      /**
       * TODO: Implement setting up flat config We can't just use readConfig because ConfigFile is
       * incompatible We will have to use babel directly
       *
       * Normal use case: before: export default [ someRule ]
       *
       * After: import storybook from 'eslint-plugin-storybook' export default [ someRule,
       * storybook.configs['flat/recommended']
       *
       * Vite boilerplate use case with typescript-eslint:
       *
       * Before: import tseslint from 'typescript-eslint' export default tseslint.config(someRule)
       *
       * After: import storybook from 'eslint-plugin-storybook' import tseslint from
       * 'typescript-eslint' export default tseslint.config(someRule,
       * storybook.configs['flat/recommended'])
       */
      const existingExtends = normalizeExtends(eslint.getFieldValue(['extends'])).filter(Boolean);
      eslint.setFieldValue(['extends'], [...existingExtends, 'plugin:storybook/recommended']);

      await writeConfig(eslint);
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
          'https://storybook.js.org/docs/configure/integration/eslint-plugin'
        )}

        Would you like to install it?
      `,
    initial: true,
  });

  return shouldInstall;
};
