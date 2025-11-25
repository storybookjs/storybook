import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  type JsPackageManager,
  type PackageJson,
  frameworkToRenderer,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  type SupportedFramework,
  SupportedLanguage,
  type SupportedRenderer,
} from 'storybook/internal/types';
import { Feature } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { coerce, satisfies } from 'semver';
import stripJsonComments from 'strip-json-comments';
import invariant from 'tiny-invariant';

import { getRendererDir } from './dirs';

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
 * @param packageJson The current package.json so we can inspect its contents
 * @returns Contains the packages and versions that need to be installed
 */
export async function getBabelDependencies(packageManager: JsPackageManager) {
  const dependenciesToAdd = [];
  let babelLoaderVersion = '^8.0.0-0';

  const babelCoreVersion = packageManager.getDependencyVersion('babel-core');

  if (!babelCoreVersion) {
    if (!packageManager.getDependencyVersion('@babel/core')) {
      const babelCoreInstallVersion = await packageManager.getVersion('@babel/core');
      dependenciesToAdd.push(`@babel/core@${babelCoreInstallVersion}`);
    }
  } else {
    const latestCompatibleBabelVersion = await packageManager.latestVersion(
      'babel-core',
      babelCoreVersion
    );
    // Babel 6
    if (latestCompatibleBabelVersion && satisfies(latestCompatibleBabelVersion, '^6.0.0')) {
      babelLoaderVersion = '^7.0.0';
    }
  }

  if (!packageManager.getDependencyVersion('babel-loader')) {
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
  templateLocation: SupportedFramework | SupportedRenderer;
  language: SupportedLanguage;
  commonAssetsDir?: string;
  destination?: string;
  features: Set<Feature>;
};

/**
 * Return the installed version of a package, or the coerced version specifier from package.json if
 * it's a dependency but not installed (e.g. in a fresh project)
 */
export async function getVersionSafe(packageManager: JsPackageManager, packageName: string) {
  try {
    let version = await packageManager.getInstalledVersion(packageName);
    if (!version) {
      const deps = packageManager.getAllDependencies();
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

export const cliStoriesTargetPath = async () => {
  if (existsSync('./src')) {
    return './src/stories';
  }
  return './stories';
};

export async function copyTemplateFiles({
  packageManager,
  templateLocation,
  language,
  destination,
  commonAssetsDir,
  features,
}: CopyTemplateFilesOptions) {
  const languageFolderMapping: Record<SupportedLanguage | 'typescript', string> = {
    [SupportedLanguage.JAVASCRIPT]: 'js',
    [SupportedLanguage.TYPESCRIPT]: 'ts',
  };
  const templatePath = async () => {
    const baseDir = await getRendererDir(packageManager, templateLocation);
    const assetsDir = join(baseDir, 'template', 'cli');

    const assetsLanguage = join(assetsDir, languageFolderMapping[language]);
    const assetsJS = join(assetsDir, languageFolderMapping[SupportedLanguage.JAVASCRIPT]);
    const assetsTS = join(assetsDir, languageFolderMapping.typescript);

    // Ideally use the assets that match the language & version.
    if (existsSync(assetsLanguage)) {
      return assetsLanguage;
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
    throw new Error(`Unsupported renderer: ${templateLocation} (${baseDir})`);
  };

  const destinationPath = destination ?? (await cliStoriesTargetPath());
  const filter = (file: string) => features.has(Feature.DOCS) || !file.endsWith('.mdx');
  if (commonAssetsDir) {
    await cp(commonAssetsDir, destinationPath, { recursive: true, filter });
  }
  await cp(await templatePath(), destinationPath, { recursive: true, filter });

  if (commonAssetsDir && features.has(Feature.DOCS)) {
    const rendererType = frameworkToRenderer[templateLocation] || 'react';

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

export function coerceSemver(version: string) {
  const coercedSemver = coerce(version);
  invariant(coercedSemver != null, `Could not coerce ${version} into a semver.`);
  return coercedSemver;
}

export function hasStorybookDependencies(packageManager: JsPackageManager) {
  const currentPackageDeps = packageManager.getAllDependencies();

  return Object.keys(currentPackageDeps).some((dep) => dep.includes('storybook'));
}
