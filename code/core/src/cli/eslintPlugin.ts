import { readJson, writeJson } from '@ndelangen/fs-extra-unified';
import { dedent } from 'ts-dedent';
import detectIndent from 'detect-indent';
import prompts from 'prompts';
import chalk from 'chalk';

import { readConfig, writeConfig } from '@storybook/core/csf-tools';
import type { JsPackageManager } from '@storybook/core/common';
import { paddedLog } from '@storybook/core/common';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';

export const SUPPORTED_ESLINT_EXTENSIONS = ['js', 'cjs', 'json'];
const UNSUPPORTED_ESLINT_EXTENSIONS = ['yaml', 'yml'];

export const findEslintFile = () => {
  const filePrefix = '.eslintrc';
  const unsupportedExtension = UNSUPPORTED_ESLINT_EXTENSIONS.find((ext: string) =>
    fs.existsSync(`${filePrefix}.${ext}`)
  );

  if (unsupportedExtension) {
    throw new Error(unsupportedExtension);
  }

  const extension = SUPPORTED_ESLINT_EXTENSIONS.find((ext: string) =>
    fs.existsSync(`${filePrefix}.${ext}`)
  );
  return extension ? `${filePrefix}.${extension}` : null;
};

export async function extractEslintInfo(packageManager: JsPackageManager): Promise<{
  hasEslint: boolean;
  isStorybookPluginInstalled: boolean;
  eslintConfigFile: string | null;
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
  return { hasEslint, isStorybookPluginInstalled, eslintConfigFile };
}

export const normalizeExtends = (existingExtends: any): string[] => {
  if (!existingExtends) return [];
  if (typeof existingExtends === 'string') return [existingExtends];
  if (Array.isArray(existingExtends)) return existingExtends;
  throw new Error(`Invalid eslint extends ${existingExtends}`);
};

export async function configureEslintPlugin(
  eslintFile: string | undefined,
  packageManager: JsPackageManager
) {
  if (eslintFile) {
    paddedLog(`Configuring Storybook ESLint plugin at ${eslintFile}`);
    if (eslintFile.endsWith('json')) {
      const eslintConfig = (await readJson(eslintFile)) as { extends?: string[] };
      const existingExtends = normalizeExtends(eslintConfig.extends).filter(Boolean);
      eslintConfig.extends = [...existingExtends, 'plugin:storybook/recommended'] as string[];

      const eslintFileContents = await readFile(eslintFile, 'utf8');
      const spaces = detectIndent(eslintFileContents).amount || 2;
      await writeJson(eslintFile, eslintConfig, { spaces });
    } else {
      const eslint = await readConfig(eslintFile);
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
        We have detected that you're using ESLint. Storybook provides a plugin that gives the best experience with Storybook and helps follow best practices: ${chalk.yellow(
          'https://github.com/storybookjs/eslint-plugin-storybook#readme'
        )}

        Would you like to install it?
      `,
    initial: true,
  });

  return shouldInstall;
};
