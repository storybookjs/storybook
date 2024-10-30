import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  frameworkToRenderer as CoreFrameworkToRenderer,
  type JsPackageManager,
  type PackageJson,
  type PackageJsonWithDepsAndDevDeps,
} from '@storybook/core/common';
import { versions as storybookMonorepoPackages } from '@storybook/core/common';
import type { SupportedFrameworks, SupportedRenderers } from '@storybook/core/types';

import { findUpSync } from 'find-up';
import picocolors from 'picocolors';
import { coerce, major, satisfies } from 'semver';
import stripJsonComments from 'strip-json-comments';
import invariant from 'tiny-invariant';

import { getRendererDir } from './dirs';
import { CommunityBuilder, CoreBuilder, SupportedLanguage } from './project_types';

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
    logger.error(picocolors.red(`Invalid json in file: ${filePath}`));
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
 * Detect if any babel dependencies need to be added to the project This is currently used by
 * react-native generator
 *
 * @example
 *
 * ```ts
 * const babelDependencies = await getBabelDependencies(
 *   packageManager,
 *   npmOptions,
 *   packageJson
 * ); // you can then spread the result when using installDependencies
 * installDependencies(npmOptions, [
 *   `@storybook/react@${storybookVersion}`,
 *   ...babelDependencies,
 * ]);
 * ```
 *
 * @param {Object} packageJson The current package.json so we can inspect its contents
 * @returns {Array} Contains the packages and versions that need to be installed
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

  cpSync(templateDir, destination, { recursive: true });
}

type CopyTemplateFilesOptions = {
  packageManager: JsPackageManager;
  renderer: SupportedFrameworks | SupportedRenderers;
  language: SupportedLanguage;
  commonAssetsDir?: string;
  destination?: string;
};

/** @deprecated Please use `frameworkToRenderer` from `@storybook/core-common` instead */
export const frameworkToRenderer = CoreFrameworkToRenderer;

export const frameworkToDefaultBuilder: Record<
  SupportedFrameworks,
  CoreBuilder | CommunityBuilder
> = {
  angular: CoreBuilder.Webpack5,
  ember: CoreBuilder.Webpack5,
  'html-vite': CoreBuilder.Vite,
  'html-webpack5': CoreBuilder.Webpack5,
  nextjs: CoreBuilder.Webpack5,
  'experimental-nextjs-vite': CoreBuilder.Vite,
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
  // Only to pass type checking, will never be used
  'react-rsbuild': CommunityBuilder.Rsbuild,
  'vue3-rsbuild': CommunityBuilder.Rsbuild,
};

/**
 * Return the installed version of a package, or the coerced version specifier from package.json if
 * it's a dependency but not installed (e.g. in a fresh project)
 */
export async function getVersionSafe(packageManager: JsPackageManager, packageName: string) {
  try {
    let version = await packageManager.getInstalledVersion(packageName);
    if (!version) {
      const deps = await packageManager.getAllDependencies();
      const versionSpecifier = deps[packageName];
      version = versionSpecifier ?? '';
    }
    const coerced = coerce(version, { includePrerelease: true });
    return coerced?.toString();
  } catch (err) {
    // fall back to no version
  }
  return undefined;
}

export async function copyTemplateFiles({
  packageManager,
  renderer,
  language,
  destination,
  commonAssetsDir,
}: CopyTemplateFilesOptions) {
  let languageFolderMapping: Record<SupportedLanguage | 'typescript', string> = {
    // keeping this for backwards compatibility in case community packages are using it
    typescript: 'ts',
    [SupportedLanguage.JAVASCRIPT]: 'js',
    [SupportedLanguage.TYPESCRIPT_3_8]: 'ts-3-8',
    [SupportedLanguage.TYPESCRIPT_4_9]: 'ts-4-9',
  };
  // FIXME: remove after 9.0
  if (renderer === 'svelte') {
    const svelteVersion = await getVersionSafe(packageManager, 'svelte');
    if (svelteVersion && major(svelteVersion) >= 5) {
      languageFolderMapping = {
        // keeping this for backwards compatibility in case community packages are using it
        typescript: 'ts',
        [SupportedLanguage.JAVASCRIPT]: 'svelte-5-js',
        [SupportedLanguage.TYPESCRIPT_3_8]: 'svelte-5-ts-3-8',
        [SupportedLanguage.TYPESCRIPT_4_9]: 'svelte-5-ts-4-9',
      };
    }
  }
  const templatePath = async () => {
    const baseDir = await getRendererDir(packageManager, renderer);
    const assetsDir = join(baseDir, 'template', 'cli');

    const assetsLanguage = join(assetsDir, languageFolderMapping[language]);
    const assetsJS = join(assetsDir, languageFolderMapping[SupportedLanguage.JAVASCRIPT]);
    const assetsTS = join(assetsDir, languageFolderMapping.typescript);
    const assetsTS38 = join(assetsDir, languageFolderMapping[SupportedLanguage.TYPESCRIPT_3_8]);

    // Ideally use the assets that match the language & version.
    if (existsSync(assetsLanguage)) {
      return assetsLanguage;
    }
    // Use fallback typescript 3.8 assets if new ones aren't available
    if (language === SupportedLanguage.TYPESCRIPT_4_9 && existsSync(assetsTS38)) {
      return assetsTS38;
    }
    // Fallback further to TS (for backwards compatibility purposes)
    if (existsSync(assetsTS)) {
      return assetsTS;
    }
    // Fallback further to JS
    if (existsSync(assetsJS)) {
      return assetsJS;
    }
    // As a last resort, look for the root of the asset directory
    if (existsSync(assetsDir)) {
      return assetsDir;
    }
    throw new Error(`Unsupported renderer: ${renderer} (${baseDir})`);
  };

  const targetPath = async () => {
    if (existsSync('./src')) {
      return './src/stories';
    }
    return './stories';
  };

  const destinationPath = destination ?? (await targetPath());
  if (commonAssetsDir) {
    await cp(commonAssetsDir, destinationPath, {
      recursive: true,
    });
  }
  await cp(await templatePath(), destinationPath, { recursive: true });

  if (commonAssetsDir) {
    let rendererType = frameworkToRenderer[renderer] || 'react';

    // This is only used for docs links and the docs site uses `vue` for both `vue` & `vue3` renderers
    if (rendererType === 'vue3') {
      rendererType = 'vue';
    }
    await adjustTemplate(join(destinationPath, 'Configure.mdx'), { renderer: rendererType });
  }
}

export async function adjustTemplate(templatePath: string, templateData: Record<string, any>) {
  // for now, we're just doing a simple string replace
  // in the future we might replace this with a proper templating engine
  let template = await readFile(templatePath, { encoding: 'utf8' });

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
