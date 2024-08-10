import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  frameworkToRenderer as CoreFrameworkToRenderer,
  type JsPackageManager,
  type PackageJson,
  type PackageJsonWithDepsAndDevDeps,
} from '@storybook/core/common';
import { versions as storybookMonorepoPackages } from '@storybook/core/common';
import type { SupportedFrameworks, SupportedRenderers } from '@storybook/core/types';

import { copy, copySync, pathExists } from '@ndelangen/fs-extra-unified';
import chalk from 'chalk';
import { findUpSync } from 'find-up';
import { coerce, satisfies } from 'semver';
import stripJsonComments from 'strip-json-comments';
import invariant from 'tiny-invariant';

import { getRendererDir } from './dirs';
import { CoreBuilder, SupportedLanguage } from './project_types';

const logger = console;

export function readFileAsJson(jsonPath: string, allowComments?: boolean) {
  const filePath = resolve(jsonPath);
  if (!existsSync(filePath)) {
    return false;
  }

  const fileContent = readFileSync(filePath, 'utf8');
  const jsonContent = allowComments ? stripJsonComments(fileContent) : fileContent;

  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    logger.error(chalk.red(`Invalid json in file: ${filePath}`));
    throw e;
  }
}

export const writeFileAsJson = (jsonPath: string, content: unknown) => {
  const filePath = resolve(jsonPath);
  if (!existsSync(filePath)) {
    return false;
  }

  writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`);
  return true;
};

/**
 * Detect if any babel dependencies need to be added to the project
 * This is currently used by react-native generator
 * @param {Object} packageJson The current package.json so we can inspect its contents
 * @returns {Array} Contains the packages and versions that need to be installed
 * @example
 * const babelDependencies = await getBabelDependencies(packageManager, npmOptions, packageJson);
 * // you can then spread the result when using installDependencies
 * installDependencies(npmOptions, [
 *   `@storybook/react@${storybookVersion}`,
 *   ...babelDependencies,
 * ]);
 */
export async function getBabelDependencies(
  packageManager: JsPackageManager,
  packageJson: PackageJsonWithDepsAndDevDeps
) {
  const dependenciesToAdd = [];
  let babelLoaderVersion = '^8.0.0-0';

  const babelCoreVersion =
    packageJson.dependencies['babel-core'] || packageJson.devDependencies['babel-core'];

  if (!babelCoreVersion) {
    if (!packageJson.dependencies['@babel/core'] && !packageJson.devDependencies['@babel/core']) {
      const babelCoreInstallVersion = await packageManager.getVersion('@babel/core');
      dependenciesToAdd.push(`@babel/core@${babelCoreInstallVersion}`);
    }
  } else {
    const latestCompatibleBabelVersion = await packageManager.latestVersion(
      'babel-core',
      babelCoreVersion
    );
    // Babel 6
    if (satisfies(latestCompatibleBabelVersion, '^6.0.0')) {
      babelLoaderVersion = '^7.0.0';
    }
  }

  if (!packageJson.dependencies['babel-loader'] && !packageJson.devDependencies['babel-loader']) {
    const babelLoaderInstallVersion = await packageManager.getVersion(
      'babel-loader',
      babelLoaderVersion
    );
    dependenciesToAdd.push(`babel-loader@${babelLoaderInstallVersion}`);
  }

  return dependenciesToAdd;
}

export function addToDevDependenciesIfNotPresent(
  packageJson: PackageJson,
  name: string,
  packageVersion: string
) {
  if (!packageJson.dependencies?.[name] && !packageJson.devDependencies?.[name]) {
    if (packageJson.devDependencies) {
      packageJson.devDependencies[name] = packageVersion;
    } else {
      packageJson.devDependencies = {
        [name]: packageVersion,
      };
    }
  }
}

export function copyTemplate(templateRoot: string, destination = '.') {
  const templateDir = resolve(templateRoot, `template-csf/`);

  if (!existsSync(templateDir)) {
    throw new Error(`Couldn't find template dir`);
  }

  copySync(templateDir, destination, { overwrite: true });
}

type CopyTemplateFilesOptions = {
  packageManager: JsPackageManager;
  renderer: SupportedFrameworks | SupportedRenderers;
  language: SupportedLanguage;
  commonAssetsDir?: string;
  destination?: string;
};

/**
 * @deprecated Please use `frameworkToRenderer` from `@storybook/core-common` instead
 */
export const frameworkToRenderer = CoreFrameworkToRenderer;

export const frameworkToDefaultBuilder: Record<SupportedFrameworks, CoreBuilder> = {
  angular: CoreBuilder.Webpack5,
  ember: CoreBuilder.Webpack5,
  'html-vite': CoreBuilder.Vite,
  'html-webpack5': CoreBuilder.Webpack5,
  nextjs: CoreBuilder.Webpack5,
  'preact-vite': CoreBuilder.Vite,
  'preact-webpack5': CoreBuilder.Webpack5,
  qwik: CoreBuilder.Vite,
  'react-vite': CoreBuilder.Vite,
  'react-webpack5': CoreBuilder.Webpack5,
  'server-webpack5': CoreBuilder.Webpack5,
  solid: CoreBuilder.Vite,
  'svelte-vite': CoreBuilder.Vite,
  'svelte-webpack5': CoreBuilder.Webpack5,
  sveltekit: CoreBuilder.Vite,
  'vue3-vite': CoreBuilder.Vite,
  'vue3-webpack5': CoreBuilder.Webpack5,
  'web-components-vite': CoreBuilder.Vite,
  'web-components-webpack5': CoreBuilder.Webpack5,
};

export async function copyTemplateFiles({
  packageManager,
  renderer,
  language,
  destination,
  commonAssetsDir,
}: CopyTemplateFilesOptions) {
  const languageFolderMapping: Record<SupportedLanguage | 'typescript', string> = {
    // keeping this for backwards compatibility in case community packages are using it
    typescript: 'ts',
    [SupportedLanguage.JAVASCRIPT]: 'js',
    [SupportedLanguage.TYPESCRIPT_3_8]: 'ts-3-8',
    [SupportedLanguage.TYPESCRIPT_4_9]: 'ts-4-9',
  };
  const templatePath = async () => {
    const baseDir = await getRendererDir(packageManager, renderer);
    const assetsDir = join(baseDir, 'template', 'cli');

    const assetsLanguage = join(assetsDir, languageFolderMapping[language]);
    const assetsJS = join(assetsDir, languageFolderMapping[SupportedLanguage.JAVASCRIPT]);
    const assetsTS = join(assetsDir, languageFolderMapping.typescript);
    const assetsTS38 = join(assetsDir, languageFolderMapping[SupportedLanguage.TYPESCRIPT_3_8]);

    // Ideally use the assets that match the language & version.
    if (await pathExists(assetsLanguage)) {
      return assetsLanguage;
    }
    // Use fallback typescript 3.8 assets if new ones aren't available
    if (language === SupportedLanguage.TYPESCRIPT_4_9 && (await pathExists(assetsTS38))) {
      return assetsTS38;
    }
    // Fallback further to TS (for backwards compatibility purposes)
    if (await pathExists(assetsTS)) {
      return assetsTS;
    }
    // Fallback further to JS
    if (await pathExists(assetsJS)) {
      return assetsJS;
    }
    // As a last resort, look for the root of the asset directory
    if (await pathExists(assetsDir)) {
      return assetsDir;
    }
    throw new Error(`Unsupported renderer: ${renderer} (${baseDir})`);
  };

  const targetPath = async () => {
    if (await pathExists('./src')) {
      return './src/stories';
    }
    return './stories';
  };

  const destinationPath = destination ?? (await targetPath());
  if (commonAssetsDir) {
    await copy(commonAssetsDir, destinationPath, {
      overwrite: true,
    });
  }
  await copy(await templatePath(), destinationPath, { overwrite: true });

  if (commonAssetsDir) {
    let rendererType = frameworkToRenderer[renderer] || 'react';
    // This is only used for docs links and the docs site uses `vue` for both `vue` & `vue3` renderers
    if (rendererType === 'vue3') rendererType = 'vue';
    await adjustTemplate(join(destinationPath, 'Configure.mdx'), { renderer: rendererType });
  }
}

export async function adjustTemplate(templatePath: string, templateData: Record<string, any>) {
  // for now, we're just doing a simple string replace
  // in the future we might replace this with a proper templating engine
  let template = await readFile(templatePath, 'utf8');

  Object.keys(templateData).forEach((key) => {
    template = template.replaceAll(`{{${key}}}`, `${templateData[key]}`);
  });

  await writeFile(templatePath, template);
}

// Given a package.json, finds any official storybook package within it
// and if it exists, returns the version of that package from the specified package.json
export function getStorybookVersionSpecifier(packageJson: PackageJsonWithDepsAndDevDeps) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
  };
  const storybookPackage = Object.keys(allDeps).find((name: string) => {
    return storybookMonorepoPackages[name as keyof typeof storybookMonorepoPackages];
  });

  if (!storybookPackage) {
    throw new Error(`Couldn't find any official storybook packages in package.json`);
  }

  return allDeps[storybookPackage];
}

export async function isNxProject() {
  return findUpSync('nx.json');
}

export function coerceSemver(version: string) {
  const coercedSemver = coerce(version);
  invariant(coercedSemver != null, `Could not coerce ${version} into a semver.`);
  return coercedSemver;
}

export async function hasStorybookDependencies(packageManager: JsPackageManager) {
  const currentPackageDeps = await packageManager.getAllDependencies();

  return Object.keys(currentPackageDeps).some((dep) => dep.includes('storybook'));
}
