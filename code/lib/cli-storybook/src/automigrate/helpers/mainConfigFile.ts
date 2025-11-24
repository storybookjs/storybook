import { dirname, isAbsolute, join, normalize } from 'node:path';

import {
  JsPackageManagerFactory,
  builderPackages,
  extractFrameworkPackageName,
  frameworkPackages,
  getStorybookInfo,
} from 'storybook/internal/common';
import type { PackageManagerName } from 'storybook/internal/common';
import { frameworkToRenderer } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { readConfig, writeConfig as writeConfigFile } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';

import { getStoriesPathsFromConfig } from '../../util';

/**
 * Given a Storybook configuration object, retrieves the package name or file path of the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The package name of the framework. If not found, returns null.
 */
export const getFrameworkPackageName = (mainConfig?: StorybookConfigRaw) => {
  const packageNameOrPath =
    typeof mainConfig?.framework === 'string' ? mainConfig.framework : mainConfig?.framework?.name;

  if (!packageNameOrPath) {
    return null;
  }

  return extractFrameworkPackageName(packageNameOrPath);
};

/**
 * Given a Storybook configuration object, retrieves the inferred renderer name from the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The renderer name. If not found, returns null.
 */
export const getRendererName = (mainConfig?: StorybookConfigRaw) => {
  const frameworkPackageName = getFrameworkPackageName(mainConfig);

  if (!frameworkPackageName) {
    return null;
  }

  const frameworkName = frameworkPackages[frameworkPackageName];

  return frameworkToRenderer[frameworkName as keyof typeof frameworkToRenderer];
};

/**
 * Given a Storybook configuration object, retrieves the package name or file path of the builder.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The package name of the builder. If not found, returns null.
 */
export const getBuilderPackageName = (mainConfig?: StorybookConfigRaw) => {
  const frameworkOptions = getFrameworkOptions(mainConfig);

  const frameworkBuilder = frameworkOptions?.builder;

  const frameworkBuilderName =
    typeof frameworkBuilder === 'string' ? frameworkBuilder : frameworkBuilder?.options?.name;

  const coreBuilderName =
    typeof mainConfig?.core?.builder === 'string'
      ? mainConfig.core.builder
      : mainConfig?.core?.builder?.name;

  const packageNameOrPath = coreBuilderName ?? frameworkBuilderName;

  if (!packageNameOrPath) {
    return null;
  }

  const normalizedPath = normalize(packageNameOrPath).replace(new RegExp(/\\/, 'g'), '/');

  return (
    Object.keys(builderPackages).find((pkg) => normalizedPath.endsWith(pkg)) || packageNameOrPath
  );
};

/**
 * Given a Storybook configuration object, retrieves the configuration for the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The configuration for the framework. If not found, returns null.
 */
export const getFrameworkOptions = (
  mainConfig?: StorybookConfigRaw
): Record<string, any> | null => {
  return typeof mainConfig?.framework === 'string'
    ? null
    : (mainConfig?.framework?.options ?? null);
};

export const getStorybookData = async ({
  configDir: userDefinedConfigDir,
  packageManagerName,
}: {
  configDir?: string;
  packageManagerName?: PackageManagerName;
  cache?: boolean;
}) => {
  logger.debug('Getting Storybook info...');
  const {
    mainConfig,
    mainConfigPath: mainConfigPath,
    configDir: configDirFromScript,
    previewConfigPath,
    version: storybookVersion,
  } = await getStorybookInfo(
    userDefinedConfigDir,
    userDefinedConfigDir ? dirname(userDefinedConfigDir) : undefined
  );

  const configDir = userDefinedConfigDir || configDirFromScript || '.storybook';

  logger.debug('Loading main config...');

  const workingDir = isAbsolute(configDir)
    ? dirname(configDir)
    : dirname(join(process.cwd(), configDir));

  logger.debug('Getting stories paths...');
  const storiesPaths = await getStoriesPathsFromConfig({
    stories: mainConfig.stories,
    configDir,
    workingDir,
  });

  logger.debug('Getting package manager...');
  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: packageManagerName,
    configDir,
    storiesPaths,
  });

  logger.debug('Getting Storybook version...');

  return {
    configDir,
    mainConfig,
    storybookVersion,
    mainConfigPath,
    previewConfigPath,
    packageManager,
    storiesPaths,
  };
};
export type GetStorybookData = typeof getStorybookData;

/**
 * A helper function to safely read and write the main config file. At the end of the callback,
 * main.js will be overwritten. If it fails, it will handle the error and log a message to the user
 * explaining what to do.
 *
 * It receives a mainConfigPath and a callback which will have access to utilities to manipulate
 * main.js.
 *
 * @example
 *
 * ```ts
 * await safeWriteMain({ mainConfigPath, dryRun }, async ({ main }) => {
 *   // manipulate main.js here
 * });
 * ```
 */
export const updateMainConfig = async (
  { mainConfigPath, dryRun }: { mainConfigPath: string; dryRun: boolean },
  callback: (main: ConfigFile) => Promise<void> | void
) => {
  try {
    const main = await readConfig(mainConfigPath);
    await callback(main);
    if (!dryRun) {
      await writeConfigFile(main);
    }
  } catch (e) {
    logger.log(
      `❌ The migration failed to update your ${picocolors.blue(
        mainConfigPath
      )} on your behalf because of the following error:
        ${e}\n`
    );
    logger.log(
      `⚠️ Storybook automigrations are based on AST parsing and it's possible that your ${picocolors.blue(
        mainConfigPath
      )} file contains a non-standard format (e.g. your export is not an object) or that there was an error when parsing dynamic values (e.g. "require" calls, or usage of environment variables). When your main config is non-standard, automigrations are unfortunately not possible. Please follow the instructions given previously and follow the documentation to make the updates manually.`
    );
  }
};

/** Check if a file is in ESM format based on its content */
export function containsESMUsage(content: string): boolean {
  // For .js/.ts files, check the content for ESM syntax
  // Check for ESM syntax indicators (multiline aware)
  const hasImportStatement =
    /^\s*import\s+/m.test(content) ||
    /^\s*import\s*{/m.test(content) ||
    /^\s*import\s*\(/m.test(content);
  const hasExportStatement =
    /^\s*export\s+/m.test(content) ||
    /^\s*export\s*{/m.test(content) ||
    /^\s*export\s*default/m.test(content);
  const hasImportMeta = /import\.meta/.test(content);

  // If any ESM syntax is found, it's likely an ESM file
  return hasImportStatement || hasExportStatement || hasImportMeta;
}

/** Check if the file content contains require usage */
export function containsRequireUsage(content: string): boolean {
  // Check for require() calls
  const requireCallRegex = /\brequire\(/;
  const requireDotRegex = /\brequire\./;
  return requireCallRegex.test(content) || requireDotRegex.test(content);
}

/** Check if the file content contains a pattern matching the given regex */
export function containsPatternUsage(content: string, pattern: RegExp): boolean {
  // Remove strings first, then comments
  const stripStrings = (s: string) => s.replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""');
  const withoutStrings = stripStrings(content);
  const withoutBlock = withoutStrings.replace(/\/\*[\s\S]*?\*\//g, '');
  const cleanContent = withoutBlock
    .split('\n')
    .map((line) => line.split('//')[0])
    .join('\n');

  // Check for pattern usage in the cleaned content
  return pattern.test(cleanContent);
}

/** Check if the file content contains __dirname usage */
export function containsDirnameUsage(content: string): boolean {
  return containsPatternUsage(content, /\b__dirname\b/);
}

export function containsFilenameUsage(content: string): boolean {
  return containsPatternUsage(content, /\b__filename\b/);
}

/** Check if __dirname is already defined in the file */
export function hasDirnameDefined(content: string): boolean {
  // Check if __dirname is already defined as a const/let/var
  const dirnameDefinedRegex = /(?:const|let|var)\s+__dirname\s*=/;
  return dirnameDefinedRegex.test(content);
}

/** Check if a specific import already exists in the file */

/** Configuration for what should be included in the compatibility banner */
export interface BannerConfig {
  hasRequireUsage: boolean;
  hasUnderscoreDirname: boolean;
  hasUnderscoreFilename: boolean;
}

export const bannerComment =
  '// This file has been automatically migrated to valid ESM format by Storybook.';

export const hasRequireBanner = (content: string): boolean => {
  return content.includes(bannerComment);
};
